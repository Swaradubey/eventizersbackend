const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const eventService = require('../services/event.service');
const prisma = require('../config/prisma');

// Ensure dotenv is loaded in non-Vercel environments
if (!process.env.GEMINI_API_KEY) {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  } catch (_) {}
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
    errMsg.includes('not found') ||
    errMsg.includes('is not found') ||
    errMsg.includes('not supported') ||
    errMsg.includes('404')
  ) {
    return 404;
  }

  return null;
}

/**
 * Calls the Gemini API with automatic exponential backoff on 429 errors.
 * Retries up to 3 times: waits 1s → 2s → 4s between attempts.
 */
async function callGeminiWithRetry(client, aiPrompt) {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: aiPrompt,
      });
      return response;
    } catch (error) {
      const code = classifyGeminiError(error);

      if (code === 429 && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(
          `Gemini 429 rate limit hit. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-429 error or final retry exhausted — re-throw
      throw error;
    }
  }
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
  "guests": []
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
    const formattedDescription = `${aiData.description || 'Join us for this special event.'}${
      aiData.theme ? `\n\n✨ **Theme**: ${aiData.theme}` : ''
    }${
      aiData.estimatedBudget ? `\n💰 **Estimated Budget**: ${aiData.estimatedBudget}` : ''
    }${
      finalGuestCount ? `\n👥 **Expected Guests**: ${finalGuestCount}` : ''
    }${
      aiData.schedule?.length ? `\n\n📅 **Schedule**:\n${aiData.schedule.map((i) => `• ${i}`).join('\n')}` : ''
    }${
      aiData.decor?.length ? `\n\n🎈 **Decor**:\n${aiData.decor.map((i) => `• ${i}`).join('\n')}` : ''
    }${
      aiData.food?.length ? `\n\n🍴 **Food & Drink**:\n${aiData.food.map((i) => `• ${i}`).join('\n')}` : ''
    }${
      aiData.activities?.length ? `\n\n🎮 **Activities**:\n${aiData.activities.map((i) => `• ${i}`).join('\n')}` : ''
    }${
      aiData.checklist?.length ? `\n\n✅ **Checklist**:\n${aiData.checklist.map((i) => `• ${i}`).join('\n')}` : ''
    }`;

    // --- DIRECT DATABASE PERSISTENCE ---
    const eventPayload = {
      title: finalTitle,
      description: formattedDescription,
      eventType: finalEventType,
      eventDate: finalDate,
      eventTime: finalIsFullDay ? '09:00' : finalStartTime,
      venue: finalVenue,
      status: 'draft',
    };

    console.log("Saving autonomously generated event to database:", eventPayload);
    const newEvent = await eventService.createEvent(eventPayload, userId);
    console.log(`Event created successfully with ID: ${newEvent.id}`);

    // Create Base Styled Invitation
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
          backgroundColor: backgroundColor,
          textColor: textColor,
          titleSize: 48,
          fontWeight: '700',
          fontFamily: 'Playfair Display',
          textAlignment: 'center',
          buttonText: 'RSVP Now',
          buttonColor: accentColor,
          buttonRadius: 12,
          status: 'draft',
        },
      });
      console.log(`Invitation created successfully with ID: ${newInvitation.id}`);
    } catch (invErr) {
      console.warn("Could not auto-create invitation:", invErr.message);
    }

    // Save Design Settings Palette
    try {
      await prisma.designSettings.upsert({
        where: { eventId: newEvent.id },
        update: {
          colorScheme: {
            preset: aiData.theme || 'AI Generated Palette',
            primaryColor: accentColor,
            secondaryColor: palette[1] || '#00C0F9',
            textColor: textColor,
          },
          typography: {
            titleFont: 'Playfair Display',
            bodyFont: 'Questrial',
          },
          background: {
            type: 'gradient',
            gradientDirection: 'to-r',
            color: backgroundColor,
          },
        },
        create: {
          eventId: newEvent.id,
          colorScheme: {
            preset: aiData.theme || 'AI Generated Palette',
            primaryColor: accentColor,
            secondaryColor: palette[1] || '#00C0F9',
            textColor: textColor,
          },
          typography: {
            titleFont: 'Playfair Display',
            bodyFont: 'Questrial',
          },
          background: {
            type: 'gradient',
            gradientDirection: 'to-r',
            color: backgroundColor,
          },
        },
      });
      console.log(`Design settings saved for event: ${newEvent.id}`);
    } catch (desErr) {
      console.warn("Could not auto-create design settings:", desErr.message);
    }

    // Standardized Redirect Destination
    const redirectUrl = `/dashboard/invitations?eventId=${newEvent.id}`;

    return res.status(201).json({
      success: true,
      message: 'Event generated and saved to dashboard successfully',
      eventId: newEvent.id,
      redirectUrl: redirectUrl,
      event: { ...newEvent, totalGuests: 0, guests: [] },
      invitation: newInvitation,
      guests: [],
      guestList: [],
      ...aiData,
      title: finalTitle,
      eventType: finalEventType,
      date: finalDate,
      startTime: finalStartTime,
      endTime: finalEndTime,
      isFullDay: finalIsFullDay,
      venue: finalVenue,
      estimatedGuestCount: finalGuestCount,
      themePalette: palette,
      accentColor: accentColor,
      backgroundColor: backgroundColor,
      textColor: textColor,
    });
  } catch (error) {
    console.error('AI Generation Error / Gemini failure:', error);
    const code = classifyGeminiError(error);

    // 429 — quota exhausted after retries
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

    const prompt = `You are an expert OCR & invitation typography designer. Analyze this invitation card image carefully and extract all event information and text blocks.

IMPORTANT COORDINATE & TYPOGRAPHY RULES:
1. Normalize all coordinates between 0.0 and 1.0 (top-left is 0,0; bottom-right is 1,1).
2. For textBlocks: x and y are CENTER coordinates as fractions (0.0 to 1.0).
3. Group related multi-word lines together (e.g. Combine Day + Date + Time into one clean line: "Sunday, February 15, 2026 at 11 AM", RSVP details as one line: "Kindly RSVP - 7905262129").
4. Ensure every text block has a distinct, well-spaced vertical 'y' position so they never overlap.
5. width and height should be generous bounding box dimensions as fractions.
6. fontSize estimate: large cursive/headings ~28-44, names ~22-30, subtext/dates ~14-18, small text ~12-14.
7. fontFamily: cursive/script -> "Great Vibes", elegant serif -> "Playfair Display", modern clean -> "Montserrat".
8. cardBgColor: exact hex color of the background paper where text sits (e.g. '#FAF4E8', '#FBF8F3', '#FFFFFF').
9. cardTextColor: exact hex color of main text (e.g. '#BE7832', '#B45309', '#1E293B').
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
  "cardTextColor": "#BE7832",
  "textBlocks": [
    {
      "text": "clean line of text",
      "role": "title|subtitle|guestOfHonor|date|time|venue|address|hostName|description|rsvp|other",
      "x": 0.5,
      "y": 0.35,
      "width": 0.65,
      "height": 0.04,
      "fontSize": 26,
      "fontFamily": "Great Vibes|Playfair Display|Montserrat",
      "color": "#BE7832",
      "align": "center"
    }
  ]
}`;

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
      fontSize: Math.min(60, Math.max(10, parseInt(block.fontSize) || 16)),
      fontFamily: block.fontFamily || 'Playfair Display',
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
 * Erases detected text blocks from an image buffer using perimeter pixel sampling
 * and smooth inpainting, returning a clean background image buffer.
 */
async function eraseTextFromImage(rawBase64, textBlocks, cardBgColor) {
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const imgBuffer = Buffer.from(rawBase64, 'base64');
    const img = await loadImage(imgBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (!textBlocks || textBlocks.length === 0) {
      return `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
    }

    // 1. Determine the true background paper color by sampling pixels across the card interior
    const samples = [];
    for (let xf = 0.22; xf <= 0.78; xf += 0.04) {
      for (let yf = 0.15; yf <= 0.85; yf += 0.04) {
        const px = Math.floor(xf * img.width);
        const py = Math.floor(yf * img.height);
        if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
          const d = ctx.getImageData(px, py, 1, 1).data;
          const r = d[0], g = d[1], b = d[2];
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
          // Filter out dark text (<165) and highly saturated artwork (>0.30)
          if (brightness > 165 && sat < 0.30) {
            samples.push({ r, g, b, brightness });
          }
        }
      }
    }

    let fillR = 250, fillG = 242, fillB = 230;
    if (samples.length > 0) {
      fillR = Math.round(samples.reduce((s, p) => s + p.r, 0) / samples.length);
      fillG = Math.round(samples.reduce((s, p) => s + p.g, 0) / samples.length);
      fillB = Math.round(samples.reduce((s, p) => s + p.b, 0) / samples.length);
    }
    const paperColor = `rgb(${fillR}, ${fillG}, ${fillB})`;

    // 2. Compute unified text envelope to erase all text seamlessly without band-aids
    if (textBlocks.length >= 3) {
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const b of textBlocks) {
        const hw = (b.width || 0.5) / 2;
        const hh = (b.height || 0.04) / 2;
        minX = Math.min(minX, Math.max(0.08, (b.x || 0.5) - hw));
        maxX = Math.max(maxX, Math.min(0.92, (b.x || 0.5) + hw));
        minY = Math.min(minY, Math.max(0.12, (b.y || 0.5) - hh));
        maxY = Math.max(maxY, Math.min(0.88, (b.y || 0.5) + hh));
      }

      // Generous padding to cover 100% of printed text from top to bottom
      const padX = 0.05;
      const padY = 0.04;
      let zx0 = Math.max(0, Math.floor((minX - padX) * img.width));
      let zy0 = Math.max(0, Math.floor((minY - padY) * img.height));
      let zx1 = Math.min(img.width, Math.ceil((maxX + padX) * img.width));
      let zy1 = Math.min(img.height, Math.ceil((maxY + padY) * img.height));

      // Guard against peeking top/bottom text if detected blocks are within inner 75%
      if (minY <= 0.35) zy0 = Math.min(zy0, Math.floor(0.165 * img.height));
      if (maxY >= 0.70) zy1 = Math.max(zy1, Math.ceil(0.835 * img.height));

      const zw = zx1 - zx0;
      const zh = zy1 - zy0;

      ctx.fillStyle = paperColor;
      ctx.beginPath();
      ctx.roundRect(zx0, zy0, zw, zh, 16);
      ctx.fill();
    } else {
      // For isolated single blocks, inpaint individually
      for (const block of textBlocks) {
        const cx = (block.x || 0.5) * img.width;
        const cy = (block.y || 0.5) * img.height;
        const bw = Math.min(img.width * 0.94, Math.max(img.width * 0.15, (block.width || 0.5) * img.width * 1.35));
        const bh = Math.min(img.height * 0.25, Math.max(img.height * 0.03, (block.height || 0.04) * img.height * 1.6));
        const x0 = Math.max(0, Math.floor(cx - bw / 2));
        const y0 = Math.max(0, Math.floor(cy - bh / 2));
        const w = Math.min(img.width - x0, Math.ceil(bw));
        const h = Math.min(img.height - y0, Math.ceil(bh));

        ctx.fillStyle = paperColor;
        ctx.beginPath();
        ctx.roundRect(x0, y0, w, h, 8);
        ctx.fill();
      }
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
