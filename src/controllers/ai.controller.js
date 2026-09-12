const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const eventService = require('../services/event.service');
const prisma = require('../config/prisma');

// Ensure dotenv is loaded in non-Vercel environments
if (!process.env.GEMINI_API_KEY) {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  } catch (_) { }
}

// Read the Gemini API key from the .env file only — no fallback providers
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Startup check — log only whether key is loaded, not the key itself
const keyIsValid =
  GEMINI_API_KEY &&
  GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
  GEMINI_API_KEY !== '';

console.log(`Gemini API key loaded: ${keyIsValid ? 'yes' : 'no'}`);

// Read Gemini model name from env, fall back to a known-good model
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
console.log(`Gemini model used: ${GEMINI_MODEL}`);

// Single shared Gemini client — initialized once using the .env API key
let aiInstance = null;
function getAiClient() {
  if (!aiInstance && keyIsValid) {
    aiInstance = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiInstance;
}

/**
 * Classifies an error as a known Gemini HTTP status.
 * Returns 429, 401, 403, 404, or null.
 */
function classifyGeminiError(error) {
  const errMsg = (error.message || error.toString() || '').toLowerCase();
  const statusCode =
    error.status ||
    error.statusCode ||
    (error.response && error.response.status);

  if (
    statusCode === 429 ||
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('too many requests')
  ) {
    return 429;
  }

  if (
    statusCode === 401 ||
    errMsg.includes('401') ||
    errMsg.includes('api_key_invalid') ||
    errMsg.includes('api key not valid') ||
    errMsg.includes('unauthorized')
  ) {
    return 401;
  }

  if (
    statusCode === 403 ||
    errMsg.includes('403') ||
    errMsg.includes('permission_denied')
  ) {
    return 403;
  }

  if (
    statusCode === 404 ||
    errMsg.includes('not found') ||
    errMsg.includes('is not found') ||
    errMsg.includes('no longer available') ||
    errMsg.includes('not supported') ||
    errMsg.includes('404')
  ) {
    return 404;
  }

  return null;
}

/**
 * Calls the Gemini API with automatic model fallback and exponential backoff on 429 errors.
 */
async function callGeminiWithRetry(client, aiPrompt) {
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-3.5-flash',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = null;

  for (const modelName of modelsToTry) {
    const MAX_RETRIES = 2;
    const BASE_DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: aiPrompt,
        });
        return response;
      } catch (error) {
        lastError = error;
        const code = classifyGeminiError(error);

        if (code === 429 && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `Gemini (${modelName}) 429 rate limit hit. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (code === 429 || code === 404) {
          console.warn(`Model ${modelName} encountered error code ${code} (${error.message}). Trying next available model...`);
          break;
        }

        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Autonomous AI Event Generation Engine
 * Parses natural language user prompt, extracts or infers complete event attributes,
 * applies smart fallbacks and user overrides, persists the event, invitation, and design
 * settings to PostgreSQL, and returns eventId & redirectUrl.
 */
const processAutonomousEventGeneration = async (req, res) => {
  try {
    const rawPrompt = (req.body.userPrompt || req.body.prompt || '').trim();
    const userId = req.user.id;

    if (!rawPrompt) {
      return res.status(400).json({ error: 'Please provide a description of your event.' });
    }

    // Guard: API key must be present
    if (!keyIsValid) {
      console.error("AI Generation failed: Gemini API key is missing or not configured in environment variables.");
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const client = getAiClient();

    // Optional user pre-filled overrides
    const {
      eventType,
      guestCount,
      date,
      time,
      startTime,
      endTime,
      isFullDay,
      venue,
      guestListId,
      guestListName,
    } = req.body;

    const today = new Date();
    const refDateStr = today.toISOString().split('T')[0];

    const aiPrompt = `
You are an expert event planner, concierge, and designer.
Today's reference date is ${refDateStr}.

The user provided the following natural language event description:
"${rawPrompt}"

${eventType ? `Explicit User Override - Event Type: "${eventType}"` : ''}
${guestCount ? `Explicit User Override - Guest Count / Group: "${guestCount}"` : ''}
${date ? `Explicit User Override - Event Date: "${date}"` : ''}
${time || startTime ? `Explicit User Override - Start Time: "${time || startTime}"` : ''}
${endTime ? `Explicit User Override - End Time: "${endTime}"` : ''}
${venue ? `Explicit User Override - Venue: "${venue}"` : ''}
${guestListName || guestListId ? `Explicit User Override - Guest List: "${guestListName || guestListId}"` : ''}

Your task is to parse all explicit details from the description, and infer realistic, creative smart defaults for any missing properties.
Do not generate fake guests or placeholder attendees.

Return the response STRICTLY as a raw JSON object with NO markdown formatting, NO backticks, NO \`\`\`json code block.
Match this exact JSON schema:
{
  "title": "string (creative, catchy event title)",
  "eventType": "string (e.g. Wedding, Birthday, Corporate Event, Baby Shower, Graduation, Networking, Fundraiser, Community Event, Private Dinner, Anniversary, Conference, Gala, or Celebration)",
  "date": "string (YYYY-MM-DD format, e.g. 2026-12-25. If not mentioned in prompt, pick an upcoming weekend date 3-5 weeks from ${refDateStr})",
  "startTime": "string (24-hour HH:MM format, e.g. '18:00'. If not mentioned, choose a sensible start time for this event type)",
  "endTime": "string (24-hour HH:MM format, e.g. '22:00'. If not mentioned, default to 3-4 hours after startTime)",
  "isFullDay": false,
  "venue": "string (venue name and location, e.g. 'Central Park Grand Hall'. If not mentioned, suggest a suitable realistic venue name)",
  "estimatedGuestCount": 120,
  "description": "string (engaging, detailed description of the event concept and atmosphere)",
  "theme": "string (overall theme or aesthetic, e.g. 'Rustic Autumn Elegance')",
  "themePalette": ["#8B4513", "#D2691E", "#F4A460", "#FFF8DC"],
  "accentColor": "string (Primary hex color code from palette, e.g. '#D2691E')",
  "backgroundColor": "string (Background hex color code for invitation, e.g. '#FAF8F5')",
  "textColor": "string (High-contrast text hex color code, e.g. '#1A1118')",
  "invitationText": "string (warm or formal invitation card copy, e.g. 'You are cordially invited to celebrate...')",
  "host": "string (host name or 'The Host')",
  "schedule": ["string (3-5 timeline steps, e.g. '18:00 - Guest Arrival & Cocktails')"],
  "decor": ["string (3-5 decor/design recommendations)"],
  "food": ["string (3-5 food and beverage concepts)"],
  "activities": ["string (3-5 entertainment or activity ideas)"],
  "checklist": ["string (3-5 setup and planning tasks)"],
  "estimatedBudget": "string (estimated budget range, e.g. '$3,000 - $6,000')",
  "guests": [],
  "stationeryDesign": {
    "backdropColor": "hex (e.g. '#FFF9F5', '#141416', '#0F172A', '#FBF5E8')",
    "envelopeColor": "hex (e.g. '#FF7043', '#D87A80', '#0F2A4A', '#C85A3B', '#064E3B')",
    "envelopeLiner": "string (must be one of: 'confetti_stars', 'gold_foil', 'botanical_leaves', 'tropical_palm', 'rose_gold_foil', 'damask', 'yellow_stripe', 'sage_pinstripe', 'plaid', 'gold_art_deco')",
    "stamp": "string (must be one of: 'Gold Wax Seal', 'Love Heart', 'Botanical Herb', 'None')",
    "cardBgColor": "hex (e.g. '#FFFDF9', '#0D0D10', '#FFFFFF')",
    "cardBorderColor": "hex (e.g. '#FF7043', '#D4AF37', '#D87A80', '#1E3A8A')",
    "artworkTheme": "string (must be one of: 'birthday_confetti', 'floral_arch', 'art_deco', 'corporate_summit', 'founders_connect', 'dinner_sunset', 'hibiscus_blooms', 'chicory_whispers', 'lovely_blossoms', 'elegant_lace', 'painted_petals', 'floral_elegance', 'limoncello')",
    "textElements": [
      { "id": "header", "role": "header", "text": "YOU ARE CORDIALLY INVITED TO CELEBRATE", "y": 0.22, "fontSize": 12, "fontFamily": "Inter", "color": "#FF7043" },
      { "id": "title", "role": "title", "text": "Event Title", "y": 0.38, "fontSize": 28, "fontFamily": "Georgia", "color": "#1E293B" },
      { "id": "details", "role": "details", "text": "Warm invitation details or subtitle", "y": 0.48, "fontSize": 12, "fontFamily": "Inter", "color": "#475569" },
      { "id": "date", "role": "date", "text": "Saturday, October 24 at 4:00 PM", "y": 0.60, "fontSize": 14, "fontFamily": "Inter", "color": "#1E293B" },
      { "id": "venue", "role": "venue", "text": "Grand Ballroom, Mumbai", "y": 0.72, "fontSize": 13, "fontFamily": "Inter", "color": "#475569" },
      { "id": "rsvp", "role": "rsvp", "text": "Kindly RSVP by Oct 18", "y": 0.84, "fontSize": 11, "fontFamily": "Inter", "color": "#94A3B8" }
    ]
  }
}
`;

    console.log("Calling Gemini API for autonomous event prompt:", rawPrompt);
    let response;
    try {
      response = await callGeminiWithRetry(client, aiPrompt);
    } catch (geminiError) {
      console.error("Gemini API call failed:", geminiError);
      throw geminiError;
    }

    const aiResultText = response.text || '';
    console.log("Raw Gemini Response received, length:", aiResultText.length);

    // Strip markdown fences or extra wrappers
    let cleanedText = aiResultText.trim();
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.substring(cleanedText.indexOf('```json') + 7);
      if (cleanedText.includes('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.lastIndexOf('```'));
      }
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.substring(cleanedText.indexOf('```') + 3);
      if (cleanedText.includes('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.lastIndexOf('```'));
      }
    }
    cleanedText = cleanedText.trim();

    let aiData;
    try {
      aiData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON.", {
        rawResponse: aiResultText,
        cleanedText: cleanedText,
        error: parseError,
      });
      return res.status(500).json({
        error: 'Gemini returned an invalid response structure. Please try again.',
      });
    }

    // --- SMART NORMALIZATION & FALLBACKS ---

    // 1. Title
    const finalTitle = aiData.title || 'AI Generated Celebration';

    // 2. Event Type (user override > AI parsed > fallback)
    const finalEventType = eventType || aiData.eventType || 'Celebration';

    // 3. Date (user override > AI parsed > upcoming Saturday ~30 days out)
    let candidateDate = date || aiData.date || aiData.eventDate;
    let finalDate;
    if (candidateDate && !isNaN(new Date(candidateDate).getTime())) {
      try {
        finalDate = new Date(candidateDate).toISOString().split('T')[0];
      } catch (_) {
        finalDate = null;
      }
    }
    if (!finalDate) {
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      finalDate = fallbackDate.toISOString().split('T')[0];
    }

    // 4. Start Time & End Time
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    let candidateStart = startTime || time || aiData.startTime || aiData.eventTime;
    let finalStartTime = "18:00";
    if (candidateStart) {
      const match = String(candidateStart).trim().match(/(\d{1,2}):(\d{2})/);
      if (match) {
        finalStartTime = `${match[1].padStart(2, '0')}:${match[2]}`;
      }
    }

    let candidateEnd = endTime || aiData.endTime;
    let finalEndTime = "22:00";
    if (candidateEnd) {
      const match = String(candidateEnd).trim().match(/(\d{1,2}):(\d{2})/);
      if (match) {
        finalEndTime = `${match[1].padStart(2, '0')}:${match[2]}`;
      }
    }

    // 5. Full Day flag
    const finalIsFullDay = typeof isFullDay === 'boolean'
      ? isFullDay
      : (aiData.isFullDay === true || String(time).toLowerCase() === 'full day');

    // 6. Venue (user override > AI parsed > fallback)
    const finalVenue = (venue && String(venue).trim()) || aiData.venue || 'The Grand Pavilion';

    // 7. Estimated Guest Count
    let finalGuestCount = 50;
    if (guestCount) {
      const parsedUserCount = parseInt(String(guestCount).replace(/\D/g, ''), 10);
      if (!isNaN(parsedUserCount) && parsedUserCount > 0) {
        finalGuestCount = parsedUserCount;
      }
    } else if (aiData.estimatedGuestCount) {
      const parsedAiCount = parseInt(String(aiData.estimatedGuestCount).replace(/\D/g, ''), 10);
      if (!isNaN(parsedAiCount) && parsedAiCount > 0) {
        finalGuestCount = parsedAiCount;
      }
    }

    // 8. Theme & Palette
    const palette = Array.isArray(aiData.themePalette) && aiData.themePalette.length > 0
      ? aiData.themePalette
      : ['#4C6FFF', '#00C0F9', '#F0EEFF'];
    const accentColor = aiData.accentColor || palette[0] || '#4C6FFF';
    const backgroundColor = aiData.backgroundColor || '#FAF8F5';
    const textColor = aiData.textColor || '#1A1118';

    // 9. Format Rich Event Description
    const formattedDescription = `${aiData.description || 'Join us for this special event.'}${aiData.theme ? `\n\n✨ **Theme**: ${aiData.theme}` : ''
      }${aiData.estimatedBudget ? `\n💰 **Estimated Budget**: ${aiData.estimatedBudget}` : ''
      }${finalGuestCount ? `\n👥 **Expected Guests**: ${finalGuestCount}` : ''
      }${aiData.schedule?.length ? `\n\n📅 **Schedule**:\n${aiData.schedule.map((i) => `• ${i}`).join('\n')}` : ''
      }${aiData.decor?.length ? `\n\n🎈 **Decor**:\n${aiData.decor.map((i) => `• ${i}`).join('\n')}` : ''
      }${aiData.food?.length ? `\n\n🍴 **Food & Drink**:\n${aiData.food.map((i) => `• ${i}`).join('\n')}` : ''
      }${aiData.activities?.length ? `\n\n🎮 **Activities**:\n${aiData.activities.map((i) => `• ${i}`).join('\n')}` : ''
      }${aiData.checklist?.length ? `\n\n✅ **Checklist**:\n${aiData.checklist.map((i) => `• ${i}`).join('\n')}` : ''
      }`;

    // 10. Normalize dynamic 4-layer stationery design & map to Evite Template Registry
    const rawSD = aiData.stationeryDesign || {};
    const normalizedStationery = {
      backdropColor: rawSD.backdropColor || backgroundColor || '#FFF9F5',
      envelopeColor: rawSD.envelopeColor || accentColor || '#FF7043',
      envelopeLiner: rawSD.envelopeLiner || (finalEventType.toLowerCase().includes('birthday') ? 'confetti_stars' : 'gold_foil'),
      stamp: rawSD.stamp || 'Gold Wax Seal',
      cardBgColor: rawSD.cardBgColor || '#FFFDF9',
      cardBorderColor: rawSD.cardBorderColor || accentColor || '#FF7043',
      artworkTheme: rawSD.artworkTheme || (finalEventType.toLowerCase().includes('birthday') ? 'birthday_confetti' : 'floral_arch'),
      textElements: Array.isArray(rawSD.textElements) && rawSD.textElements.length > 0
        ? rawSD.textElements
        : [
          { id: 'header', role: 'header', text: 'YOU ARE CORDIALLY INVITED TO CELEBRATE', y: 0.22, fontSize: 12, fontFamily: 'Inter', color: accentColor },
          { id: 'title', role: 'title', text: finalTitle, y: 0.38, fontSize: 28, fontFamily: 'Georgia', color: textColor },
          { id: 'details', role: 'details', text: aiData.invitationText || aiData.description || 'Join us for a wonderful celebration!', y: 0.48, fontSize: 12, fontFamily: 'Inter', color: '#475569' },
          { id: 'date', role: 'date', text: `${finalDate} at ${finalStartTime}`, y: 0.60, fontSize: 14, fontFamily: 'Inter', color: textColor },
          { id: 'venue', role: 'venue', text: finalVenue, y: 0.72, fontSize: 13, fontFamily: 'Inter', color: '#475569' },
          { id: 'rsvp', role: 'rsvp', text: 'Kindly RSVP by upcoming week', y: 0.84, fontSize: 11, fontFamily: 'Inter', color: '#94A3B8' }
        ]
    };
    const aiStationeryDesign = normalizedStationery;

    // Map theme/eventType to Evite 4-layer decoupled templates
    const THEME_TO_TEMPLATE_MAP = {
      birthday_confetti: { id: 'tpl-cake-and-confetti', image: '/assets/templates/cake-and-confetti-bg.svg' },
      floral_arch: { id: 'tpl-floral-elegance', image: '/assets/templates/floral_elegance_scene.jpg' },
      art_deco: { id: 'tpl-charity-gala', image: '/assets/templates/gala.jpg' },
      corporate_summit: { id: 'tpl-corporate-launch', image: '/assets/templates/corporate.jpg' },
      founders_connect: { id: 'tpl-net-founders', image: '/assets/templates/networking_founders.jpg' },
      dinner_sunset: { id: 'tpl-dinner-party', image: '/assets/templates/dinner.jpg' },
      hibiscus_blooms: { id: 'tpl-hibiscus-blooms', image: '/assets/templates/hibiscus_blooms_scene.jpg' },
      chicory_whispers: { id: 'tpl-chicory-whispers', image: '/assets/templates/chicory_whispers_scene.jpg' },
      lovely_blossoms: { id: 'tpl-lovely-blossoms', image: '/assets/templates/lovely_blossoms_scene.jpg' },
      elegant_lace: { id: 'tpl-elegant-lace', image: '/assets/templates/elegant_lace_scene.jpg' },
      painted_petals: { id: 'tpl-painted-petals', image: '/assets/templates/painted_petals_scene.jpg' },
      floral_elegance: { id: 'tpl-floral-elegance', image: '/assets/templates/floral_elegance_scene.jpg' },
      limoncello: { id: 'tpl-limoncello', image: '/assets/templates/limoncello_scene.jpg' },
    };

    let matchedTpl = THEME_TO_TEMPLATE_MAP[normalizedStationery?.artworkTheme];
    if (!matchedTpl) {
      const typeLower = (finalEventType || 'Celebration').toLowerCase();
      if (typeLower.includes('birthday')) {
        matchedTpl = { id: 'tpl-cake-and-confetti', image: '/assets/templates/cake-and-confetti-bg.svg' };
      } else if (typeLower.includes('wedding')) {
        matchedTpl = { id: 'tpl-wedding-liam', image: '/assets/templates/wedding.jpg' };
      } else if (typeLower.includes('shower') || typeLower.includes('baby')) {
        matchedTpl = { id: 'tpl-baby-shower', image: '/assets/templates/babyshower.jpg' };
      } else if (typeLower.includes('dinner') || typeLower.includes('food')) {
        matchedTpl = { id: 'tpl-dinner-party', image: '/assets/templates/dinner.jpg' };
      } else if (typeLower.includes('corp') || typeLower.includes('summit') || typeLower.includes('launch')) {
        matchedTpl = { id: 'tpl-corporate-launch', image: '/assets/templates/corporate.jpg' };
      } else if (typeLower.includes('anniversary')) {
        matchedTpl = { id: 'tpl-anniversary-james', image: '/assets/templates/anniversary.jpg' };
      } else {
        matchedTpl = { id: 'tpl-cake-and-confetti', image: '/assets/templates/cake-and-confetti-bg.svg' };
      }
    }

    // --- DIRECT DATABASE PERSISTENCE ---
    const eventPayload = {
      title: finalTitle,
      description: formattedDescription,
      eventType: finalEventType,
      eventDate: finalDate,
      eventTime: finalIsFullDay ? '09:00' : finalStartTime,
      venue: finalVenue,
      coverImage: matchedTpl.image,
      selectedTemplateId: matchedTpl.id,
      status: 'draft',
    };

    console.log("Saving autonomously generated event with template to database:", eventPayload);
    const newEvent = await eventService.createEvent(eventPayload, userId);
    console.log(`Event created successfully with ID: ${newEvent.id}, Template: ${matchedTpl.id}`);

    // Create Base Styled Invitation with Template & Stationery
    let newInvitation = null;
    try {
      newInvitation = await prisma.invitation.create({
        data: {
          eventId: newEvent.id,
          title: finalTitle,
          subtitle: aiData.host || finalVenue,
          mainText: aiData.invitationText || aiData.description || 'You are cordially invited.',
          message: formattedDescription,
          accentColor: accentColor,
          backgroundColor: normalizedStationery.cardBgColor || backgroundColor,
          textColor: textColor,
          titleSize: 48,
          fontWeight: '700',
          fontFamily: 'Playfair Display',
          textAlignment: 'center',
          buttonText: 'RSVP Now',
          buttonColor: accentColor,
          buttonRadius: 12,
          imageUrl: matchedTpl.image,
          status: 'draft',
        },
      });
      console.log(`Invitation created successfully with ID: ${newInvitation.id}`);
    } catch (invErr) {
      console.warn("Could not auto-create invitation:", invErr.message);
    }

    // Save Design Settings Palette (Evite 4-layer config)
    try {
      await prisma.designSettings.upsert({
        where: { eventId: newEvent.id },
        update: {
          colorScheme: {
            preset: aiData.theme || 'AI Generated Palette',
            primaryColor: accentColor,
            secondaryColor: palette[1] || '#00C0F9',
            textColor: textColor,
            envelopeColor: normalizedStationery.envelopeColor,
            backdropColor: normalizedStationery.backdropColor,
          },
          typography: {
            titleFont: 'Playfair Display',
            bodyFont: 'Montserrat',
          },
          background: {
            type: 'color',
            color: normalizedStationery.cardBgColor || backgroundColor,
          },
        },
        create: {
          eventId: newEvent.id,
          colorScheme: {
            preset: aiData.theme || 'AI Generated Palette',
            primaryColor: accentColor,
            secondaryColor: palette[1] || '#00C0F9',
            textColor: textColor,
            envelopeColor: normalizedStationery.envelopeColor,
            backdropColor: normalizedStationery.backdropColor,
          },
          typography: {
            titleFont: 'Playfair Display',
            bodyFont: 'Montserrat',
          },
          background: {
            type: 'color',
            color: normalizedStationery.cardBgColor || backgroundColor,
          },
        },
      });
      console.log(`Design settings saved for event: ${newEvent.id}`);
    } catch (desErr) {
      console.warn("Could not auto-create design settings:", desErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Event generated and saved to dashboard successfully',
      eventId: newEvent.id,
      templateId: matchedTpl.id,
      selectedTemplateId: matchedTpl.id,
      redirectUrl: `/dashboard/invitations?eventId=${newEvent.id}&studio=true&templateId=${matchedTpl.id}`,
      event: { ...newEvent, selectedTemplateId: matchedTpl.id, coverImage: matchedTpl.image, totalGuests: 0, guests: [] },
      invitation: { ...newInvitation, templateId: matchedTpl.id, imageUrl: matchedTpl.image },
      guests: [],
      guestList: [],
      ...aiData,
      title: finalTitle,
      description: aiData.description || 'Join us for a wonderful celebration!',
      stationeryDesign: aiStationeryDesign,
    });
  } catch (error) {
    console.error("Autonomous AI event creation failed:", error);
    const code = classifyGeminiError(error);

    // 429 — rate limit / quota exceeded
    if (code === 429) {
      return res.status(429).json({
        error: 'Gemini service is temporarily unavailable. Please try again in a few moments.',
      });
    }

    // 401 / 403 — invalid or unauthorized key
    if (code === 401 || code === 403) {
      return res.status(401).json({
        error: 'Invalid Gemini API key.',
      });
    }

    // 404 — model not found or unsupported
    if (code === 404) {
      return res.status(500).json({
        error: `Gemini model "${GEMINI_MODEL}" was not found or is not supported. Check your GEMINI_MODEL environment variable.`,
      });
    }

    return res.status(500).json({ error: error.message || 'Failed to generate event with AI. Please try again later.' });
  }
};

const generateEventWithAI = async (req, res) => {
  return processAutonomousEventGeneration(req, res);
};

const generateStructuredEventWithAI = async (req, res) => {
  return processAutonomousEventGeneration(req, res);
};

/**
 * Scan an uploaded invitation card image using Gemini Vision.
 * Extracts structured event data (title, date, time, venue, description, hostName)
 * from the image and returns it as JSON.
 * 
 * Expects: req.body.imageBase64 — a base64-encoded image string
 *          (with or without the "data:image/...;base64," prefix)
 */
const scanInvitationImage = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided. Send imageBase64 in the request body.' });
    }

    if (!keyIsValid) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const client = getAiClient();

    // Handle HTTP / HTTPS URLs or Base64 Data URI
    let rawBase64 = imageBase64;
    let mimeType = 'image/png';

    if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
      try {
        const fetchRes = await fetch(imageBase64);
        const arrayBuf = await fetchRes.arrayBuffer();
        rawBase64 = Buffer.from(arrayBuf).toString('base64');
        const cType = fetchRes.headers.get('content-type');
        if (cType) mimeType = cType.split(';')[0];
      } catch (fetchErr) {
        console.error('Failed to fetch image URL for OCR:', fetchErr.message);
      }
    } else {
      const dataUriMatch = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        rawBase64 = dataUriMatch[2];
      }
    }

    const prompt = `You are an expert OCR & invitation typography designer. Analyze this invitation card image carefully and extract all event information and exact text blocks.

EXACT TYPOGRAPHY, POSITION & COLOR RULES:
1. Normalize all coordinates between 0.0 and 1.0 (0,0 is top-left, 1,1 is bottom-right).
2. For textBlocks: x is horizontal center (0.0 to 1.0), y is vertical center (0.0 to 1.0) where the text sits.
3. Group related multi-word lines together into clean lines (e.g. "Sunday, February 15, 2026 at 11 AM", "Kindly RSVP - 7905262129").
4. Preserve vertical order from top to bottom. Ensure adjacent lines have at least 0.05 to 0.08 difference in 'y' so they NEVER overlap or collide.
5. width and height: generous bounding box dimensions as fractions (e.g. width: 0.65, height: 0.04).
6. fontSize (in points for mobile preview):
   - Huge title / anniversary / numbers: 20 to 24
   - Couple / Celebrant names: 16 to 20
   - Subtitles / Headings / Dates / Venue: 12 to 14
   - Small details / Attire / RSVP: 10 to 12
7. fontFamily (MATCH the visual style on the card exactly):
   - Cursive / Script / Calligraphy / Swashes -> "Great Vibes"
   - Elegant Roman Caps / Classic Luxury Serif -> "Cinzel" or "Playfair Display" or "Georgia"
   - Clean Modern Sans-Serif / Small Text -> "Inter" or "Montserrat"
8. color: Extract the EXACT HEX color of the text strokes for each line (e.g. gold '#B4823E', dark brown '#8B4513', maroon '#800020', navy '#1E293B').
9. cardBgColor: exact hex color of the background paper (e.g. '#FAF4E8', '#FFF8EE', '#FFFFFF').
10. Return ONLY valid JSON, no markdown, no code fences.

Return a JSON object:
{
  "title": "Main title / celebration heading",
  "eventType": "Type of event (wedding, anniversary, birthday, etc.)",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "venue": "Venue or location name",
  "address": "Full address if visible",
  "hostName": "Host name(s)",
  "description": "Tagline or secondary text",
  "guestOfHonor": "Name of person/couple being celebrated",
  "cardBgColor": "#FAF4E8",
  "cardTextColor": "#8B4513",
  "textBlocks": [
    {
      "text": "clean line of text",
      "role": "title|subtitle|guestOfHonor|date|time|venue|address|hostName|description|rsvp|other",
      "x": 0.5,
      "y": 0.35,
      "width": 0.65,
      "height": 0.04,
      "fontSize": 18,
      "fontFamily": "Great Vibes|Cinzel|Playfair Display|Georgia|Inter|Montserrat",
      "color": "#8B4513",
      "align": "center"
    }
  ]
};`;

    const response = await callGeminiWithRetry(client, [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: rawBase64,
            },
          },
          { text: prompt },
        ],
      },
    ]);

    const aiText = (response?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    console.log('Gemini Vision OCR raw response length:', aiText.length);

    // Parse the JSON response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = aiText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Gemini Vision response:', aiText.substring(0, 500));
      return res.status(200).json({
        title: null,
        eventType: null,
        date: null,
        time: null,
        venue: null,
        address: null,
        hostName: null,
        description: aiText.substring(0, 200) || null,
        guestOfHonor: null,
        textBlocks: [],
        rawText: aiText,
      });
    }

    // Ensure textBlocks is always an array
    if (!Array.isArray(parsed.textBlocks)) {
      parsed.textBlocks = [];
    }

    // Clamp all positions to valid range and preserve fonts/colors
    parsed.textBlocks = parsed.textBlocks.map(block => ({
      text: block.text || '',
      role: block.role || 'other',
      x: Math.min(1, Math.max(0, parseFloat(block.x) || 0.5)),
      y: Math.min(1, Math.max(0, parseFloat(block.y) || 0.5)),
      width: Math.min(1, Math.max(0.05, parseFloat(block.width) || 0.6)),
      height: Math.min(0.4, Math.max(0.04, parseFloat(block.height) || 0.08)),
      fontSize: Math.min(32, Math.max(10, parseInt(block.fontSize) || 16)),
      fontFamily: block.fontFamily || (['title', 'header', 'subtitle', 'guestOfHonor'].includes(block.role) ? 'Georgia' : 'Inter'),
      color: block.color || parsed.cardTextColor || '#1E293B',
      align: ['left', 'center', 'right'].includes(block.align) ? block.align : 'center',
    }));

    // Erase text from the card image using smart sampled inpainting
    try {
      const blocksToErase = parsed.textBlocks.length > 0
        ? parsed.textBlocks
        : [{ x: 0.5, y: 0.55, width: 0.88, height: 0.54 }];
      const cleaned = await eraseTextFromImage(rawBase64, blocksToErase, parsed.cardBgColor);
      if (cleaned) {
        parsed.cleanedImageBase64 = cleaned;
      }
    } catch (inpaintErr) {
      console.error('Inpainting error:', inpaintErr.message);
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Scan invitation image error:', error);
    const code = classifyGeminiError(error);
    if (code === 429) {
      return res.status(429).json({ error: 'AI service is busy. Please try again in a moment.' });
    }
    return res.status(500).json({ error: error.message || 'Failed to scan invitation image.' });
  }
};

/**
 * Helper to extract Buffer from various Replicate SDK output formats
 * (URL string, ReadableStream, Blob, or object with url)
 */
async function extractBufferFromReplicateOutput(output) {
  if (!output) return null;
  if (typeof output === 'string') {
    if (output.startsWith('http://') || output.startsWith('https://')) {
      const fetchRes = await fetch(output);
      return Buffer.from(await fetchRes.arrayBuffer());
    }
    return Buffer.from(output, 'base64');
  }
  if (typeof output.getReader === 'function') {
    const reader = output.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  if (typeof output.blob === 'function') {
    const blob = await output.blob();
    return Buffer.from(await blob.arrayBuffer());
  }
  if (typeof output.url === 'function' || output.url) {
    const u = typeof output.url === 'function' ? output.url() : output.url;
    const fetchRes = await fetch(u);
    return Buffer.from(await fetchRes.arrayBuffer());
  }
  return null;
}

/**
 * Erases detected text blocks from an image buffer using Replicate AI models
 * (FLUX Text-Removal & LaMa Inpainting), with adaptive local inpainting as fallback.
 */
async function eraseTextFromImage(rawBase64, textBlocks, cardBgColor) {
  try {
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // 1. Replicate AI Inpainting / Text Removal
    if (replicateToken && replicateToken !== 'your_replicate_api_token') {
      const Replicate = require('replicate');
      const replicate = new Replicate({ auth: replicateToken });
      const imgDataUri = `data:image/jpeg;base64,${rawBase64}`;

      // Approach A: FLUX.1 Kontext Text-Removal (Erases ALL text seamlessly without rectangular box patches)
      try {
        console.log('[Replicate] Attempting FLUX.1 text-removal model...');
        const fluxOutput = await replicate.run(
          'flux-kontext-apps/text-removal:324855075a979ec21334c810d5a10eee201019169e5234fa4ce494dc58398442',
          {
            input: {
              input_image: imgDataUri,
              output_format: 'png',
            },
          }
        );
        const cleanBuf = await extractBufferFromReplicateOutput(fluxOutput);
        if (cleanBuf && cleanBuf.length > 0) {
          console.log(`[Replicate] FLUX text-removal success! Output size: ${cleanBuf.length} bytes`);
          return `data:image/png;base64,${cleanBuf.toString('base64')}`;
        }
      } catch (fluxErr) {
        console.warn('[Replicate] FLUX text-removal failed, trying LaMa inpainting:', fluxErr.message);
      }

      // Approach B: LaMa (Large Mask Inpainting) with generated mask
      try {
        const { createCanvas, loadImage } = require('@napi-rs/canvas');
        const imgBuffer = Buffer.from(rawBase64, 'base64');
        const img = await loadImage(imgBuffer);

        const maskCanvas = createCanvas(img.width, img.height);
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(0, 0, img.width, img.height);
        maskCtx.fillStyle = '#FFFFFF';

        const blocks = (textBlocks && textBlocks.length > 0)
          ? textBlocks
          : [{ x: 0.5, y: 0.55, width: 0.88, height: 0.55 }];

        for (const block of blocks) {
          const cx = (block.x || 0.5) * img.width;
          const cy = (block.y || 0.5) * img.height;
          const bw = Math.min(img.width * 0.94, Math.max(img.width * 0.15, (block.width || 0.5) * img.width * 1.15));
          const bh = Math.min(img.height * 0.20, Math.max(img.height * 0.035, (block.height || 0.04) * img.height * 1.35));
          const x0 = Math.max(0, Math.floor(cx - bw / 2));
          const y0 = Math.max(0, Math.floor(cy - bh / 2));
          const w = Math.min(img.width - x0, Math.ceil(bw));
          const h = Math.min(img.height - y0, Math.ceil(bh));
          maskCtx.fillRect(x0, y0, w, h);
        }

        const maskDataUri = `data:image/png;base64,${maskCanvas.toBuffer('image/png').toString('base64')}`;
        console.log('[Replicate] Attempting LaMa model with generated mask...');
        const lamaOutput = await replicate.run(
          'allenhooo/lama:cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72',
          {
            input: {
              image: imgDataUri,
              mask: maskDataUri,
            },
          }
        );
        const cleanBuf = await extractBufferFromReplicateOutput(lamaOutput);
        if (cleanBuf && cleanBuf.length > 0) {
          console.log(`[Replicate] LaMa inpainting success! Output size: ${cleanBuf.length} bytes`);
          return `data:image/png;base64,${cleanBuf.toString('base64')}`;
        }
      } catch (lamaErr) {
        console.warn('[Replicate] LaMa inpainting failed, falling back to local:', lamaErr.message);
      }
    }

    // 2. Fallback: High-Precision Per-Line Adaptive Inpainter
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (!textBlocks || textBlocks.length === 0) {
      return `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
    }

    for (const block of textBlocks) {
      const cx = (block.x || 0.5) * img.width;
      const cy = (block.y || 0.5) * img.height;
      const bw = Math.min(img.width * 0.92, Math.max(img.width * 0.12, (block.width || 0.5) * img.width * 1.08));
      const bh = Math.min(img.height * 0.15, Math.max(img.height * 0.025, (block.height || 0.035) * img.height * 1.18));
      const x0 = Math.max(0, Math.floor(cx - bw / 2));
      const y0 = Math.max(0, Math.floor(cy - bh / 2));
      const w = Math.min(img.width - x0, Math.ceil(bw));
      const h = Math.min(img.height - y0, Math.ceil(bh));

      // Sample local background pixels directly above and below this line
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let sampleX = x0; sampleX <= x0 + w; sampleX += 6) {
        const topY = Math.max(0, y0 - 3);
        const botY = Math.min(img.height - 1, y0 + h + 3);
        [topY, botY].forEach(sy => {
          const d = ctx.getImageData(sampleX, sy, 1, 1).data;
          const bri = (d[0] * 299 + d[1] * 587 + d[2] * 114) / 1000;
          if (bri > 150) {
            rSum += d[0]; gSum += d[1]; bSum += d[2]; count++;
          }
        });
      }

      let fillR = 250, fillG = 242, fillB = 230;
      if (count > 0) {
        fillR = Math.round(rSum / count);
        fillG = Math.round(gSum / count);
        fillB = Math.round(bSum / count);
      }

      ctx.fillStyle = `rgb(${fillR}, ${fillG}, ${fillB})`;
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, h, 6);
      ctx.fill();
    }

    const cleanBuffer = canvas.toBuffer('image/jpeg', 95);
    return `data:image/jpeg;base64,${cleanBuffer.toString('base64')}`;
  } catch (err) {
    console.error('eraseTextFromImage helper error:', err);
    return null;
  }
}

module.exports = {
  generateEventWithAI,
  generateStructuredEventWithAI,
  scanInvitationImage,
};
