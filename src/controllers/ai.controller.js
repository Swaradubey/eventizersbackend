const { GoogleGenAI } = require('@google/genai');
const eventService = require('../services/event.service');
const prisma = require('../config/prisma');

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateEventWithAI = async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ error: "Please provide a prompt to generate the event." });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.status(500).json({ error: "Gemini API key is missing or invalid in backend .env file." });
    }

    const aiPrompt = `
      You are an expert event planner and designer. 
      The user wants to create an event based on this description: "${prompt}"

      Generate a creative, detailed event structure including:
      1. A catchy title.
      2. A beautiful, inviting description.
      3. Suggested event date (choose a realistic future date, like next month, ISO string).
      4. Suggested event time (e.g. "18:00").
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: aiPrompt,
    });

    let aiResultText = response.text;
    
    // Clean up markdown block if it exists
    if (aiResultText.startsWith('```json')) {
      aiResultText = aiResultText.replace('```json', '').replace('```', '').trim();
    } else if (aiResultText.startsWith('```')) {
      aiResultText = aiResultText.replace('```', '').replace('```', '').trim();
    }

    const aiData = JSON.parse(aiResultText);

    // Create the event in the database using the AI generated data
    const eventPayload = {
      title: aiData.title,
      description: aiData.description,
      eventDate: aiData.eventDate,
      eventTime: aiData.eventTime,
      venue: aiData.venue,
      // You can add more fields if needed
    };

    const newEvent = await eventService.createEvent(eventPayload, userId);

    // Automatically create a base invitation for this event
    const newInvitation = await prisma.invitation.create({
      data: {
        eventId: newEvent.id,
        title: aiData.title,
        description: aiData.description,
        location: aiData.venue,
        date: new Date(aiData.eventDate),
        userId: userId,
        accentColor: aiData.accentColor,
        backgroundColor: aiData.backgroundColor,
      }
    });

    return res.status(201).json({
      success: true,
      message: "Event generated successfully by AI",
      event: newEvent,
      invitation: newInvitation
    });

  } catch (error) {
    console.error("AI Generation Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate event with AI." });
  }
};

module.exports = {
  generateEventWithAI
};
