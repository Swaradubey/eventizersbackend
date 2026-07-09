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

const generateEventWithAI = async (req, res) => {
  try {
    const { prompt, eventType, guestCount, date, time, guestListId, guestListName } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ error: 'Please provide a prompt to generate the event.' });
    }

    // Guard: API key must be present — never fall back to mock data
    if (!keyIsValid) {
      console.error("AI Generation failed: Gemini API key is missing or not configured in environment variables.");
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const client = getAiClient();

    const aiPrompt = `
      You are an expert event planner and designer.
      The user wants to create an event based on this description: "${prompt}"
      ${eventType ? `Event Type constraint: ${eventType}` : ''}
      ${guestCount ? `Guest Count constraint: ${guestCount}` : ''}
      ${date ? `Required Event Date: ${date}` : ''}
      ${time ? `Required Event Time: ${time}` : ''}
      ${guestListName || guestListId ? `Target Guest List: ${guestListName || guestListId}` : ''}

      Generate a creative, detailed event structure including both event parameters and invitation design options.
      Return the response STRICTLY as a JSON object with NO markdown formatting, NO \`\`\`json block, just raw JSON matching this schema:
      {
        "title": "string (the catchy event title)",
        "eventType": "string (one of: Birthday, Baby Shower, Graduation, Wedding, Corporate Event, Networking, Fundraiser, Community Event, Private Dinner, or other suitable type)",
        "eventDate": "string (YYYY-MM-DD format)",
        "eventTime": "string (HH:MM format, 24-hour, e.g. '18:00')",
        "venue": "string (venue name/location)",
        "host": "string (the host name, e.g. 'The Patels' or individual/organization)",
        "description": "string (engaging event description)",
        "accentColor": "string (Hex color code, e.g. #FF5733)",
        "backgroundColor": "string (Hex color code, e.g. #2D1B3D)",
        "textColor": "string (Hex color code, readable against the background, e.g. #FAF8F5)",
        "invitationText": "string (formal/fun invite text to print on card, e.g. 'You are cordially invited...')",
        "fontFamily": "string (one of: 'Playfair Display', 'Inter', 'Georgia', 'monospace')",
        "fontWeight": "string (one of: '300', '400', '500', '600', '700', '800')",
        "titleSize": "number (an integer between 28 and 64)",
        "buttonText": "string (button text, e.g. 'RSVP Now')",
        "buttonColor": "string (Hex color code, e.g. #FF5733)",
        "buttonRadius": "number (an integer between 0 and 24)"
      }
    `;

    // Call Gemini with automatic retry on 429
    console.log("Calling Gemini API for prompt:", prompt);
    let response;
    try {
      response = await callGeminiWithRetry(client, aiPrompt);
    } catch (geminiError) {
      console.error("Gemini API call failed:", geminiError);
      throw geminiError;
    }

    let aiResultText = response.text;
    console.log("Raw Gemini Response:", aiResultText);

    // Strip markdown code fences if present, also trim whitespace
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
        error: parseError
      });
      return res.status(500).json({
        error: 'Gemini returned an invalid JSON response. Please try again.'
      });
    }

    // Robust validation/formatting of date and time to prevent database crashes
    let finalDate = date || aiData.eventDate;
    if (!finalDate || isNaN(new Date(finalDate).getTime())) {
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      finalDate = fallbackDate.toISOString().split('T')[0];
      console.warn(`Malformed date received: ${aiData.eventDate}. Using fallback date: ${finalDate}`);
    }

    let finalTime = time || aiData.eventTime;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!finalTime || !timeRegex.test(String(finalTime).trim())) {
      finalTime = "18:00";
      console.warn(`Malformed time received: ${aiData.eventTime}. Using fallback time: ${finalTime}`);
    } else {
      finalTime = String(finalTime).trim();
    }

    // Create the event in the database using the AI-generated data
    const eventPayload = {
      title: aiData.title || 'AI Generated Event',
      description: aiData.description || 'Join us for our AI-generated event.',
      eventType: eventType || aiData.eventType || 'Other',
      eventDate: finalDate,
      eventTime: finalTime,
      venue: aiData.venue || 'Grand Plaza Hotel',
      status: 'draft',
    };

    console.log("Saving generated event to database with payload:", eventPayload);
    const newEvent = await eventService.createEvent(eventPayload, userId);
    console.log(`Event saved successfully with ID: ${newEvent.id}`);

    // Automatically create a fully styled base invitation for this event
    const newInvitation = await prisma.invitation.create({
      data: {
        eventId: newEvent.id,
        title: aiData.title || newEvent.title,
        subtitle: aiData.host || aiData.venue || 'TBD',
        mainText: aiData.invitationText || aiData.description || 'You are cordially invited.',
        message: aiData.description || 'Event Details description',
        accentColor: aiData.accentColor || '#5B5FEF',
        backgroundColor: aiData.backgroundColor || '#F6F9FC',
        textColor: aiData.textColor || '#1A1118',
        titleSize: Number(aiData.titleSize) || 48,
        fontWeight: String(aiData.fontWeight) || '700',
        fontFamily: aiData.fontFamily || 'Playfair Display',
        textAlignment: 'center',
        buttonText: aiData.buttonText || 'RSVP Now',
        buttonColor: aiData.buttonColor || aiData.accentColor || '#5B5FEF',
        buttonRadius: Number(aiData.buttonRadius) || 12,
        status: 'draft',
      },
    });
    console.log(`Invitation design saved successfully with ID: ${newInvitation.id}`);

    // Automatically seed mock guests if a guest list was selected
    const selectedList = guestListName || guestListId;
    if (selectedList && selectedList !== '') {
      let mockGuests = [];
      if (selectedList.includes('Family')) {
        mockGuests = [
          { name: 'John Doe', email: 'john.doe@example.com' },
          { name: 'Jane Doe', email: 'jane.doe@example.com' },
          { name: 'Uncle Bob', email: 'bob.uncle@example.com' },
        ];
      } else if (selectedList.includes('Friends')) {
        mockGuests = [
          { name: 'Alice Smith', email: 'alice.smith@example.com' },
          { name: 'Charlie Brown', email: 'charlie.brown@example.com' },
          { name: 'David Miller', email: 'david.miller@example.com' },
        ];
      } else if (selectedList.includes('Colleagues') || selectedList.includes('Work')) {
        mockGuests = [
          { name: 'Manager Mark', email: 'mark.manager@example.com' },
          { name: 'Colleague Kate', email: 'kate.colleague@example.com' },
        ];
      } else if (selectedList.includes('Neighbors')) {
        mockGuests = [
          { name: 'Neighbor Ned', email: 'ned.neighbor@example.com' },
          { name: 'Nancy Nextdoor', email: 'nancy.nextdoor@example.com' },
        ];
      } else if (selectedList.includes('VIP')) {
        mockGuests = [
          { name: 'CEO Clara', email: 'clara.ceo@example.com' },
          { name: 'President Paul', email: 'paul.president@example.com' },
        ];
      }

      if (mockGuests.length > 0) {
        await prisma.guest.createMany({
          data: mockGuests.map((g) => ({
            eventId: newEvent.id,
            name: g.name,
            email: g.email,
            status: 'invited',
          })),
        });
        console.log(`Seeded ${mockGuests.length} mock guests for the event.`);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Event generated successfully by AI',
      event: newEvent,
      invitation: newInvitation,
    });
  } catch (error) {
    console.error('AI Generation Error / Gemini failure:', error);
    const code = classifyGeminiError(error);

    // 429 — quota exhausted after all retries
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

    return res.status(500).json({ error: 'Failed to generate event with AI. Please try again later.' });
  }
};

const generateStructuredEventWithAI = async (req, res) => {
  try {
    const { prompt, eventType, guestCount, date, time, guestListName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Please provide a prompt to generate the event.' });
    }

    // Guard: API key must be present — never fall back to mock data
    if (!keyIsValid) {
      console.error("AI Generation failed: Gemini API key is missing or not configured in environment variables.");
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const client = getAiClient();

    const aiPrompt = `
      You are an expert event planner and designer.
      The user wants to create an event based on this description: "${prompt}"
      ${eventType ? `Event Type constraint: ${eventType}` : ''}
      ${guestCount ? `Guest Count/Group constraint: ${guestCount}` : ''}
      ${date ? `Required Event Date: ${date}` : ''}
      ${time ? `Required Event Time: ${time}` : ''}
      ${guestListName ? `Target Guest List: ${guestListName}` : ''}

      Generate a creative, detailed event plan.
      Return the response STRICTLY as a JSON object with NO markdown formatting, NO \`\`\`json block, just raw JSON matching this schema:
      {
        "title": "string (creative, catchy event title)",
        "description": "string (engaging, detailed description of the event)",
        "theme": "string (the overall aesthetic/theme of the event)",
        "schedule": ["string (at least 3-5 timeline steps, e.g., '14:00 - Guests Arrive')"],
        "decor": ["string (3-5 decor/design suggestions)"],
        "food": ["string (3-5 food and beverage ideas)"],
        "activities": ["string (3-5 event activities/games)"],
        "checklist": ["string (3-5 todo list tasks for setting up the event)"],
        "estimatedBudget": "string (an estimated budget or range, e.g., '$500 - $1,000')"
      }
    `;

    // Call Gemini with automatic retry on 429
    console.log("Calling Gemini API with structured prompt for:", prompt);
    let response;
    try {
      response = await callGeminiWithRetry(client, aiPrompt);
    } catch (geminiError) {
      console.error("Gemini API call failed:", geminiError);
      throw geminiError;
    }

    let aiResultText = response.text;
    console.log("Raw Gemini Response:", aiResultText);

    // Strip markdown code fences if present, also trim whitespace
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
        error: parseError
      });
      return res.status(500).json({
        error: 'Gemini returned an invalid JSON response. Please try again.'
      });
    }

    // Validate structured shape and fields
    const requiredFields = ["title", "description", "theme", "schedule", "decor", "food", "activities", "checklist", "estimatedBudget"];
    for (const field of requiredFields) {
      if (!aiData[field]) {
        aiData[field] = field === "title" || field === "description" || field === "theme" || field === "estimatedBudget" ? "TBD" : [];
      }
    }

    // Ensure array types are arrays
    const arrayFields = ["schedule", "decor", "food", "activities", "checklist"];
    for (const field of arrayFields) {
      if (!Array.isArray(aiData[field])) {
        aiData[field] = typeof aiData[field] === 'string' ? [aiData[field]] : [];
      }
    }

    return res.status(200).json(aiData);
  } catch (error) {
    console.error('AI Generation Error / Gemini failure:', error);
    const code = classifyGeminiError(error);

    // 429 — quota exhausted after all retries
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

    return res.status(500).json({ error: 'Failed to generate event with AI. Please try again later.' });
  }
};

module.exports = {
  generateEventWithAI,
  generateStructuredEventWithAI,
};
