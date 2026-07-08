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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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

      Generate a creative, detailed event structure including:
      1. A catchy title.
      2. A beautiful, inviting description.
      3. Suggested event date (choose a realistic future date, like next month, ISO string${date ? `, or use the provided date: ${date}` : ''}).
      4. Suggested event time (e.g. "18:00"${time ? `, or use the provided time: ${time}` : ''}).
      5. Venue name (e.g. "Grand Plaza Hotel").
      6. A design palette for the invitation card (accentColor and backgroundColor in Hex, e.g. #FF5733).

      Return the response STRICTLY as a JSON object with NO markdown formatting, NO \`\`\`json block, just raw JSON matching this schema:
      {
        "title": "string",
        "description": "string",
        "eventDate": "string",
        "eventTime": "string",
        "venue": "string",
        "accentColor": "string",
        "backgroundColor": "string"
      }
    `;

    // Call Gemini with automatic retry on 429
    const response = await callGeminiWithRetry(client, aiPrompt);

    let aiResultText = response.text;

    // Strip markdown code fences if present
    if (aiResultText.startsWith('```json')) {
      aiResultText = aiResultText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (aiResultText.startsWith('```')) {
      aiResultText = aiResultText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const aiData = JSON.parse(aiResultText);

    // Create the event in the database using the AI-generated data
    const eventPayload = {
      title: aiData.title,
      description: aiData.description,
      eventType: eventType || aiData.eventType || 'Other',
      eventDate: date || aiData.eventDate,
      eventTime: time || aiData.eventTime,
      venue: aiData.venue || 'TBD',
      status: 'draft',
    };

    const newEvent = await eventService.createEvent(eventPayload, userId);

    // Automatically create a base invitation for this event
    const newInvitation = await prisma.invitation.create({
      data: {
        eventId: newEvent.id,
        title: aiData.title,
        subtitle: aiData.venue || 'TBD',
        message: aiData.description,
        accentColor: aiData.accentColor || '#9970d0',
        backgroundColor: aiData.backgroundColor || '#2D1B3D',
      },
    });

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
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Event generated successfully by AI',
      event: newEvent,
      invitation: newInvitation,
    });
  } catch (error) {
    console.error('AI Generation Error:', error);
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
};
