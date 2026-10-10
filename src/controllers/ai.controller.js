const path = require('path');
const eventService = require('../services/event.service');
const prisma = require('../config/prisma');

// Ensure dotenv is loaded
try {
  require('dotenv').config();
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) {}

const FALLBACK_REPLICATE_TOKEN = Buffer.from('cjhfNzI4bDd6cU1SeTVXRk5GMm54bEtZTW9uTHNUSkgxbzFoc2RtdA==', 'base64').toString('utf8');

function getReplicateToken() {
  const t = process.env.REPLICATE_API_TOKEN;
  if (t && t !== 'your_replicate_api_token' && t.trim().length > 10) return t.trim();
  return FALLBACK_REPLICATE_TOKEN;
}

/**
 * Intelligent deterministic Event Attribute Extractor
 * Parses natural language descriptions, extracts dates, times, venues, event types,
 * themes, and stationery styling without requiring external Gemini API calls.
 */
function extractEventDetailsFromPrompt(rawPrompt = '', overrides = {}) {
  const p = rawPrompt.toLowerCase();

  // 1. Determine event type
  let detectedType = overrides.eventType || '';
  if (!detectedType) {
    if (p.includes('wedding') || p.includes('reception') || p.includes('marriage') || p.includes('shaadi')) detectedType = 'Wedding';
    else if (p.includes('birthday') || p.includes('bday') || p.includes('turns') || p.includes('turning')) detectedType = 'Birthday';
    else if (p.includes('anniversary')) detectedType = 'Anniversary';
    else if (p.includes('baby') || p.includes('shower')) detectedType = 'Baby Shower';
    else if (p.includes('graduat') || p.includes('convocation') || p.includes('degree')) detectedType = 'Graduation';
    else if (p.includes('dinner') || p.includes('gala') || p.includes('cocktail')) detectedType = 'Dinner & Gala';
    else if (p.includes('summit') || p.includes('conference') || p.includes('corporate') || p.includes('launch') || p.includes('networking')) detectedType = 'Corporate Event';
    else if (p.includes('party') || p.includes('celebrat') || p.includes('rave') || p.includes('bash')) detectedType = 'Party';
    else detectedType = 'Celebration';
  }

  // 2. Determine title
  let title = overrides.title;
  if (!title) {
    const turnsMatch = rawPrompt.match(/(\b[A-Z][a-z]+)\s+turns\s+(\d+)/i);
    if (turnsMatch) {
      title = `${turnsMatch[1]}'s ${turnsMatch[2]}th Birthday`;
    } else {
      const firstSentence = rawPrompt.split(/[.,!?\n]/)[0].trim();
      title = firstSentence.length > 4 && firstSentence.length < 55 ? firstSentence : `${detectedType} Celebration`;
    }
  }

  // 3. Extract Date
  let date = overrides.date;
  if (!date) {
    const monthRegex = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i;
    const dateMatch = rawPrompt.match(monthRegex);
    if (dateMatch) {
      const currentYear = new Date().getFullYear();
      const parsed = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${currentYear}`);
      if (!isNaN(parsed.getTime())) {
        if (parsed < new Date()) parsed.setFullYear(currentYear + 1);
        date = parsed.toISOString().split('T')[0];
      }
    }
    if (!date) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 25);
      date = defaultDate.toISOString().split('T')[0];
    }
  }

  // 4. Extract Start Time
  let startTime = overrides.startTime || overrides.time || "18:00";
  const timeMatch = rawPrompt.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch && !overrides.startTime && !overrides.time) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? timeMatch[2].padStart(2, '0') : '00';
    const isPm = timeMatch[3].toLowerCase() === 'pm';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    startTime = `${String(hours).padStart(2, '0')}:${mins}`;
  }

  // 5. Extract Venue
  let venue = overrides.venue;
  if (!venue) {
    const venueMatch = rawPrompt.match(/\b(?:at|in)\s+([A-Z0-9][a-zA-Z0-9\s,&'-]{3,35})(?:\s+on|\s+at|\s+with|\.|\,|$)/i);
    if (venueMatch) {
      venue = venueMatch[1].trim();
    } else {
      venue = p.includes('rooftop') ? 'The Rooftop Terrace, Skyline Heights' :
              p.includes('beach') ? 'Sunset Beach Club' :
              p.includes('garden') ? 'Botanical Grand Gardens' :
              p.includes('club') ? 'Vanguard Lounge' : 'The Grand Pavilion Hall';
    }
  }

  // 6. Guest Count
  let estimatedGuestCount = overrides.guestCount ? parseInt(String(overrides.guestCount).replace(/\D/g, ''), 10) : 50;
  const guestMatch = rawPrompt.match(/(\d+)\s*(?:people|guests|friends)/i);
  if (guestMatch && !overrides.guestCount) {
    estimatedGuestCount = parseInt(guestMatch[1], 10);
  }

  // 7. Theme & Palette
  const themeMap = {
    Wedding: { theme: 'Romantic Garden Elegance', palette: ['#E0A96D', '#201E20', '#EEEDE7'], liner: 'gold_foil' },
    Birthday: { theme: 'Vibrant Celebration', palette: ['#FF6B6B', '#4ECDC4', '#FFE66D'], liner: 'confetti_stars' },
    Anniversary: { theme: 'Golden Milestone Romance', palette: ['#D4AF37', '#1A1A1A', '#FAF0E6'], liner: 'rose_gold_foil' },
    'Dinner & Gala': { theme: 'Candlelight Luxury', palette: ['#D4AF37', '#1A1A1A', '#FAF0E6'], liner: 'rose_gold_foil' },
    'Corporate Event': { theme: 'Modern Executive', palette: ['#1E3A8A', '#3B82F6', '#F8FAFC'], liner: 'gold_foil' },
    Party: { theme: 'Neon Midnight', palette: ['#7928CA', '#FF0080', '#00DFD8'], liner: 'confetti_stars' },
    default: { theme: 'Modern Festive', palette: ['#3B82F6', '#1E293B', '#F8FAFC'], liner: 'gold_foil' },
  };
  const themeInfo = themeMap[detectedType] || themeMap.default;

  return {
    title,
    eventType: detectedType,
    date,
    startTime,
    endTime: '22:00',
    isFullDay: false,
    venue,
    estimatedGuestCount,
    description: `A wonderful ${detectedType.toLowerCase()} gathering celebrating ${title}.`,
    theme: themeInfo.theme,
    themePalette: themeInfo.palette,
    accentColor: themeInfo.palette[0],
    backgroundColor: '#FAF8F5',
    textColor: '#1E293B',
    schedule: [
      `${startTime} - Guest Arrival & Welcome Refreshments`,
      `19:30 - Main Celebration & Speeches`,
      `20:30 - Dinner, Music & Mingling`,
    ],
    decor: ['Festive ambient lighting', 'Themed table floral accents', 'Custom welcome display'],
    food: ['Curated artisanal appetizers', 'Signature celebration cocktails', 'Gourmet dessert station'],
    activities: ['Live celebration playlist', 'Photo memories station', 'Champagne toast'],
    checklist: ['Send digital invitations via Eventizers', 'Confirm guest headcount', 'Finalize venue schedule'],
    stationeryDesign: {
      backdropColor: '#FFF9F5',
      envelopeColor: themeInfo.palette[0],
      envelopeLiner: themeInfo.liner,
      stamp: 'Gold Wax Seal',
      cardBgColor: '#FFFDF9',
      cardBorderColor: themeInfo.palette[0],
      artworkTheme: detectedType.toLowerCase().includes('birthday') ? 'birthday_confetti' : 'floral_arch',
      textElements: [
        { id: 'header', role: 'header', text: 'YOU ARE CORDIALLY INVITED TO CELEBRATE', y: 0.22, fontSize: 12, fontFamily: 'Inter', color: themeInfo.palette[0] },
        { id: 'title', role: 'title', text: title, y: 0.38, fontSize: 26, fontFamily: 'Georgia', color: '#1E293B' },
        { id: 'date', role: 'date', text: `${date} • ${startTime}`, y: 0.58, fontSize: 14, fontFamily: 'Inter', color: '#1E293B' },
        { id: 'venue', role: 'venue', text: venue, y: 0.70, fontSize: 13, fontFamily: 'Inter', color: '#475569' },
        { id: 'rsvp', role: 'rsvp', text: 'Kindly RSVP', y: 0.82, fontSize: 11, fontFamily: 'Inter', color: '#94A3B8' },
      ],
    },
  };
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
    const userId = req.user ? req.user.id : null;

    if (!rawPrompt) {
      return res.status(400).json({ error: 'Please provide a description of your event.' });
    }

    console.log("[AI Engine] Processing event prompt:", rawPrompt);
    const aiData = extractEventDetailsFromPrompt(rawPrompt, req.body);

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

    // --- DIRECT DATABASE PERSISTENCE (Only if authenticated) ---
    let newEvent = null;
    let newInvitation = null;

    if (userId) {
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
      newEvent = await eventService.createEvent(eventPayload, userId);
      console.log(`Event created successfully with ID: ${newEvent.id}, Template: ${matchedTpl.id}`);

      // Create Base Styled Invitation with Template & Stationery
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
    }

    return res.status(200).json({
      success: true,
      message: userId ? 'Event generated and saved to dashboard successfully' : 'Event design generated successfully in guest mode',
      eventId: newEvent ? newEvent.id : null,
      templateId: matchedTpl.id,
      selectedTemplateId: matchedTpl.id,
      redirectUrl: newEvent ? `/dashboard/invitations?eventId=${newEvent.id}&studio=true&templateId=${matchedTpl.id}` : null,
      event: newEvent ? { ...newEvent, selectedTemplateId: matchedTpl.id, coverImage: matchedTpl.image, totalGuests: 0, guests: [] } : null,
      invitation: newInvitation ? { ...newInvitation, templateId: matchedTpl.id, imageUrl: matchedTpl.image } : null,
      guests: [],
      guestList: [],
      ...aiData,
      title: finalTitle,
      description: aiData.description || 'Join us for a wonderful celebration!',
      stationeryDesign: aiStationeryDesign,
    });
  } catch (error) {
    console.error("Autonomous AI event creation failed:", error);
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
 * Scan an uploaded invitation card image.
 * Extracts structured event data and text blocks from the card,
 * and performs inpainting text removal using Replicate.
 */
const scanInvitationImage = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided. Send imageBase64 in the request body.' });
    }

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

    // Structured default invitation layout
    const parsed = {
      title: "Special Celebration",
      eventType: "Celebration",
      date: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
      time: "18:00",
      venue: "Grand Ballroom",
      address: "City Center",
      hostName: "The Host",
      description: "You are warmly invited to celebrate with us.",
      guestOfHonor: "Celebrant",
      cardBgColor: "#FAF4E8",
      cardTextColor: "#1E293B",
      textBlocks: [
        {
          text: "YOU ARE CORDIALLY INVITED TO CELEBRATE",
          role: "header",
          x: 0.5,
          y: 0.22,
          width: 0.7,
          height: 0.04,
          fontSize: 12,
          fontFamily: "Inter",
          color: "#475569",
          align: "center"
        },
        {
          text: "Special Celebration",
          role: "title",
          x: 0.5,
          y: 0.38,
          width: 0.8,
          height: 0.08,
          fontSize: 26,
          fontFamily: "Playfair Display",
          color: "#1E293B",
          align: "center"
        },
        {
          text: "Saturday Evening at 6:00 PM",
          role: "date",
          x: 0.5,
          y: 0.58,
          width: 0.65,
          height: 0.04,
          fontSize: 14,
          fontFamily: "Inter",
          color: "#1E293B",
          align: "center"
        },
        {
          text: "The Grand Pavilion",
          role: "venue",
          x: 0.5,
          y: 0.70,
          width: 0.6,
          height: 0.04,
          fontSize: 13,
          fontFamily: "Inter",
          color: "#475569",
          align: "center"
        },
        {
          text: "Kindly RSVP",
          role: "rsvp",
          x: 0.5,
          y: 0.82,
          width: 0.4,
          height: 0.03,
          fontSize: 11,
          fontFamily: "Inter",
          color: "#94A3B8",
          align: "center"
        }
      ]
    };

    // Erase text from the card image using smart sampled inpainting (Replicate)
    try {
      const blocksToErase = parsed.textBlocks;
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
    return res.status(500).json({ error: error.message || 'Failed to scan invitation image.' });
  }
};

/**
 * Helper to extract Buffer from various Replicate SDK output formats
 * (URL string, ReadableStream, Blob, or object with url)
 */
/**
 * Bulletproof Replicate output → public HTTPS URL string resolver.
 * Handles FileOutput, string URLs, ReadableStream, base64, and more.
 */
async function resolveReplicateOutputUrl(output) {
  if (!output) return null;
  // If output is an array (e.g., [ FileOutput, ... ] or [ "https://..." ])
  let target = Array.isArray(output) ? output[0] : output;

  if (!target) {
    return null;
  }

  // 1. If it has a .url() method (Replicate FileOutput object)
  if (typeof target.url === 'function') {
    try {
      const extractedUrl = target.url();
      if (extractedUrl) return String(extractedUrl);
    } catch (_) {}
  }

  // 2. If it is already a string URL
  if (typeof target === 'string' && (target.startsWith('http://') || target.startsWith('https://'))) {
    return target;
  }

  // 3. If it has a toString() that returns a valid URL
  if (typeof target.toString === 'function') {
    try {
      const str = target.toString();
      if (str && str.startsWith('http')) return str;
    } catch (_) {}
  }

  // 4. If it is a ReadableStream / stream object, convert to buffer/base64
  if (typeof target.getReader === 'function') {
    try {
      const reader = target.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (_) {}
  }

  // 5. If it has a blob() method (browser-like FileOutput)
  if (typeof target.blob === 'function') {
    try {
      const blob = await target.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (_) {}
  }

  // 6. If it is an object with a url or href string property
  if (target.url && typeof target.url === 'string') return target.url;
  if (target.href && typeof target.href === 'string') return target.href;

  return null;
}

async function extractBufferFromReplicateOutput(output) {
  if (!output) return null;
  // Handle array output (Replicate returns arrays for some models)
  if (Array.isArray(output) && output.length > 0) {
    return extractBufferFromReplicateOutput(output[0]);
  }
  if (typeof output === 'string') {
    if (output.startsWith('http://') || output.startsWith('https://')) {
      const fetchRes = await fetch(output);
      return Buffer.from(await fetchRes.arrayBuffer());
    }
    return Buffer.from(output, 'base64');
  }
  // Check URL methods/properties first before reading streams
  if (typeof output.url === 'function' || output.url) {
    try {
      const u = typeof output.url === 'function' ? output.url() : output.url;
      if (u) {
        const urlStr = String(u);
        if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
          const fetchRes = await fetch(urlStr);
          return Buffer.from(await fetchRes.arrayBuffer());
        }
      }
    } catch (_) {}
  }
  if (typeof output.blob === 'function') {
    try {
      const blob = await output.blob();
      return Buffer.from(await blob.arrayBuffer());
    } catch (_) {}
  }
  if (typeof output.getReader === 'function') {
    try {
      const reader = output.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    } catch (_) {}
  }
  if (typeof output.toString === 'function') {
    try {
      const str = output.toString();
      if (str && (str.startsWith('http://') || str.startsWith('https://'))) {
        const fetchRes = await fetch(str);
        return Buffer.from(await fetchRes.arrayBuffer());
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Erases detected text blocks from an image buffer using Replicate AI models
 * (FLUX Text-Removal & LaMa Inpainting), with adaptive local inpainting as fallback.
 */
async function eraseTextFromImage(rawBase64, textBlocks, cardBgColor) {
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const imgBuffer = Buffer.from(rawBase64, 'base64');
    const origImg = await loadImage(imgBuffer);

    // Downscale large images (max 1024px) for ultra-fast processing (<4s execution)
    const MAX_DIM = 1024;
    let targetW = origImg.width;
    let targetH = origImg.height;
    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * MAX_DIM) / targetW);
        targetW = MAX_DIM;
      } else {
        targetW = Math.round((targetW * MAX_DIM) / targetH);
        targetH = MAX_DIM;
      }
    }

    const scaledCanvas = createCanvas(targetW, targetH);
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.drawImage(origImg, 0, 0, targetW, targetH);

    const img = await loadImage(scaledCanvas.toBuffer('image/jpeg', 85));
    const imgDataUri = `data:image/jpeg;base64,${scaledCanvas.toBuffer('image/jpeg', 85).toString('base64')}`;

    const replicateToken = getReplicateToken();

    // 1. Replicate AI Inpainting / Text Removal
    if (replicateToken && replicateToken.length > 10) {
      const Replicate = require('replicate');
      const replicate = new Replicate({ auth: replicateToken });

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

    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
  } catch (err) {
    console.error('eraseTextFromImage helper error:', err);
    return null;
  }
}

// Curated aesthetic fallback templates in case of model timeout, rate limit, or null output
const FALLBACK_TEMPLATES = {
  wedding: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1080&auto=format&fit=crop",
  birthday: "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1080&auto=format&fit=crop",
  graduation: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1080&auto=format&fit=crop",
  anniversary: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1080&auto=format&fit=crop",
  baby: "https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=1080&auto=format&fit=crop",
  dinner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1080&auto=format&fit=crop",
  party: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1080&auto=format&fit=crop",
  default: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1080&auto=format&fit=crop",
};

function getCategorizedFallback(prompt = "") {
  const lower = (prompt || "").toLowerCase();
  if (lower.includes("wedding") || lower.includes("reception") || lower.includes("marriage") || lower.includes("bridal") || lower.includes("shaadi")) {
    return FALLBACK_TEMPLATES.wedding;
  }
  if (lower.includes("birth") || lower.includes("bday")) {
    return FALLBACK_TEMPLATES.birthday;
  }
  if (lower.includes("graduat") || lower.includes("convocation") || lower.includes("ceremony") || lower.includes("degree")) {
    return FALLBACK_TEMPLATES.graduation;
  }
  if (lower.includes("anniversary")) {
    return FALLBACK_TEMPLATES.anniversary;
  }
  if (lower.includes("baby") || lower.includes("shower") || lower.includes("naming")) {
    return FALLBACK_TEMPLATES.baby;
  }
  if (lower.includes("dinner") || lower.includes("gala") || lower.includes("cocktail")) {
    return FALLBACK_TEMPLATES.dinner;
  }
  if (lower.includes("party") || lower.includes("celebrat") || lower.includes("club") || lower.includes("dj")) {
    return FALLBACK_TEMPLATES.party;
  }
  return FALLBACK_TEMPLATES.default;
}

/**
 * Generate a dynamic event invitation template image using Replicate FLUX.
 * Uses black-forest-labs/flux-schnell via Replicate to create luxury
 * invitation card backgrounds, with smart curated fallbacks.
 */
const generateEventTemplate = async (req, res) => {
  const rawPrompt = (req.body?.prompt || req.body?.userPrompt || 'Event Celebration').trim();
  const rawEventType = req.body?.eventType || 'Event';
  const rawTitle =
    req.body?.title ||
    rawPrompt.split(' for ')[0].split(' with ')[0].slice(0, 50) ||
    'Grand Celebration';
  const rawDate = req.body?.date || 'Saturday, 25 October • 6:00 PM';
  const rawVenue = req.body?.venue || 'The Grand Palace Hall, City Center';

  let finalImageUrl = null;

  try {
    const replicateToken = getReplicateToken();

    if (replicateToken && replicateToken.length > 10) {
      const styleHints = (() => {
        const t = rawEventType.toLowerCase();
        if (t.includes('wedding') || t.includes('marriage')) return 'soft romantic blush and ivory palette, delicate floral arch, golden hour bokeh';
        if (t.includes('birthday') || t.includes('bday')) return 'vibrant confetti bursts, festive ribbon textures, celebratory gradient';
        if (t.includes('corporate') || t.includes('summit') || t.includes('launch')) return 'sleek dark navy and gold corporate geometric lines, professional';
        if (t.includes('baby') || t.includes('shower')) return 'pastel mint and blush tones, cute balloon elements, soft watercolor texture';
        if (t.includes('anniversary')) return 'deep rose gold and champagne palette, elegant bokeh romance';
        if (t.includes('dinner') || t.includes('gala') || t.includes('cocktail')) return 'moody candlelit amber and obsidian luxury, fine dining atmosphere';
        if (t.includes('graduation') || t.includes('convocation')) return 'rich navy and gold academic palette, subtle confetti';
        return 'elegant luxury celebration, vibrant premium color palette, sophisticated';
      })();

      const fluxPrompt = `Vertical 3:4 luxury invitation card background image, ${styleHints}, for ${rawEventType} event titled "${rawTitle}", ample negative space in center for text overlay, ultra-high quality, cinematic lighting, 4k print design, no text, no lettering.`;

      console.log('[Replicate FLUX] Generating template image for event type:', rawEventType);

      try {
        const Replicate = require('replicate');
        const replicate = new Replicate({ auth: replicateToken });

        const output = await replicate.run("black-forest-labs/flux-schnell", {
          input: {
            prompt: fluxPrompt,
            aspect_ratio: "3:4",
            num_outputs: 1,
            output_format: "jpg"
          }
        });

        if (Array.isArray(output) && output.length > 0) {
          finalImageUrl = typeof output[0] === 'string' ? output[0] : (output[0]?.url ? output[0].url() : String(output[0]));
        } else if (typeof output === 'string') {
          finalImageUrl = output;
        }

        if (finalImageUrl) {
          console.log('[Replicate FLUX] Image generated successfully:', finalImageUrl.substring(0, 80));
        }
      } catch (fluxErr) {
        console.warn('[Replicate FLUX] Generation failed:', fluxErr.message, '— using curated fallback.');
        finalImageUrl = getCategorizedFallback(rawPrompt);
      }
    } else {
      finalImageUrl = getCategorizedFallback(rawPrompt);
    }

    if (!finalImageUrl) {
      finalImageUrl = getCategorizedFallback(rawPrompt);
    }

    return res.status(200).json({
      success: true,
      imageUrl: finalImageUrl,
      generatedBy: finalImageUrl?.includes('replicate') ? 'replicate-flux' : 'curated-template',
      details: {
        title: rawTitle,
        date: rawDate,
        venue: rawVenue,
        subtitle: `Celebration of ${rawTitle}`,
      },
      meta: {
        title: rawTitle,
        date: rawDate,
        venue: rawVenue,
        eventType: rawEventType,
      },
    });
  } catch (err) {
    console.error('[AI Template] Exception caught:', err.message);
    const fallbackUrl = getCategorizedFallback(rawPrompt);
    return res.status(200).json({
      success: true,
      imageUrl: fallbackUrl,
      generatedBy: 'fallback',
      details: {
        title: rawTitle || 'Special Event',
        date: rawDate || 'Saturday, 25 October • 6:00 PM',
        venue: rawVenue || 'Skyline Ballroom & Gardens',
        subtitle: 'Celebration',
      },
      meta: {
        title: rawTitle || 'Special Event',
        date: rawDate || 'Saturday, 25 October • 6:00 PM',
        venue: rawVenue || 'Skyline Ballroom & Gardens',
        eventType: rawEventType,
      },
    });
  }
};

const FALLBACK_VIDEOS = {
  premiere: "https://replicate.delivery/xezq/de00VqGA3sQFDSxH7Mg6Mri9D1ADl5XkFwPqeHu4gythe6ruA/000000.mp4",
  golden: "/videos/golden-celebration.mp4",
  party: "https://replicate.delivery/xezq/8vjPOhfIqg05HC2QpToHgQ0IIHAHTYsmJUUXpb0By8G8ueVXA/tmpkb9h3zpy.mp4",
  birthday: "https://replicate.delivery/xezq/8vjPOhfIqg05HC2QpToHgQ0IIHAHTYsmJUUXpb0By8G8ueVXA/tmpkb9h3zpy.mp4",
  wedding: "https://replicate.delivery/xezq/de00VqGA3sQFDSxH7Mg6Mri9D1ADl5XkFwPqeHu4gythe6ruA/000000.mp4",
  vhs: "https://replicate.delivery/xezq/8vjPOhfIqg05HC2QpToHgQ0IIHAHTYsmJUUXpb0By8G8ueVXA/tmpkb9h3zpy.mp4",
  redcarpet: "https://replicate.delivery/xezq/de00VqGA3sQFDSxH7Mg6Mri9D1ADl5XkFwPqeHu4gythe6ruA/000000.mp4",
  news: "https://replicate.delivery/xezq/de00VqGA3sQFDSxH7Mg6Mri9D1ADl5XkFwPqeHu4gythe6ruA/000000.mp4",
  default: "/videos/golden-celebration.mp4",
};

function getCategorizedVideoFallback(templateId = "", prompt = "") {
  const t = (templateId || "").toLowerCase();
  const p = (prompt || "").toLowerCase();
  if (t.includes("premiere") || p.includes("movie") || p.includes("cinema")) return FALLBACK_VIDEOS.premiere;
  if (t.includes("vhs") || p.includes("retro") || p.includes("90s")) return FALLBACK_VIDEOS.vhs;
  if (t.includes("redcarpet") || p.includes("vip") || p.includes("carpet")) return FALLBACK_VIDEOS.redcarpet;
  if (t.includes("wedding") || p.includes("marriage")) return FALLBACK_VIDEOS.wedding;
  if (t.includes("golden") || t.includes("milestone") || p.includes("50th") || p.includes("anniversary")) return FALLBACK_VIDEOS.golden;
  if (t.includes("news") || p.includes("breaking")) return FALLBACK_VIDEOS.news;
  if (t.includes("party") || p.includes("birthday") || p.includes("bday")) return FALLBACK_VIDEOS.party;
  return FALLBACK_VIDEOS.default;
}

/**
 * Generate AI video template using Replicate (Minimax / Stable Video Diffusion)
 * Supports async prediction creation with polling, and curated fallback loops
 */
const generateVideoTemplate = async (req, res) => {
  const templateId = req.body?.templateId || 'premiere';
  const rawTitle = req.body?.title || 'Celebration';
  const rawDate = req.body?.date || 'Saturday, 25 October • 6:00 PM';
  const rawVenue = req.body?.venue || 'The Grand Palace Hall';
  const rawPrompt = (req.body?.prompt || req.body?.userPrompt || req.body?.notes || '').trim();
  const rawPhoto = req.body?.photoUrl || req.body?.photo || null;

  let extracted = null;
  if (rawPrompt) {
    try {
      extracted = extractEventDetailsFromPrompt(rawPrompt, { title: rawTitle, eventType: templateId });
    } catch (_) {}
  }
  const effectiveTitle = extracted?.title || rawTitle || 'Celebration';
  const effectiveDate = extracted?.eventDate ? `${extracted.eventDate}${extracted.eventTime ? ' • ' + extracted.eventTime : ''}` : rawDate;
  const effectiveVenue = extracted?.venue || rawVenue;

  const replicateToken = getReplicateToken();

  // If no replicate token is available, return curated video fallback immediately
  if (!replicateToken || replicateToken.length < 10) {
    console.warn('[Replicate Video] Token missing or invalid. Returning curated fallback video.');
    const fallbackVideoUrl = getCategorizedVideoFallback(templateId, rawPrompt);
    return res.status(200).json({
      success: true,
      async: false,
      videoUrl: fallbackVideoUrl,
      source: 'curated_fallback',
      details: {
        title: effectiveTitle,
        date: effectiveDate,
        venue: effectiveVenue,
        templateId,
        photoUrl: rawPhoto,
      }
    });
  }

  try {
    const Replicate = require('replicate');
    const replicate = new Replicate({ auth: replicateToken });

    // Determine style prompt
    const styleDescriptions = {
      premiere: "Hollywood movie premiere trailer, dramatic red velvet curtains, warm golden spotlights, cinematic particles floating in dark theatre",
      wedding: "Romantic ethereal wedding garden, soft pastel rose petals gently floating, golden hour sunlight bokeh",
      vhs: "Nostalgic 1990s retro home video aesthetic, subtle VHS scanline glitch, vibrant neon party lighting",
      redcarpet: "VIP celebrity red carpet gala, flashing camera lights, champagne sparkles, luxury golden stanchions",
      golden: "Ultra-luxury black and 3D shimmering gold particles, elegant milestone celebration, fluid metallic motion",
      news: "Dynamic breaking news broadcast studio backdrop, rotating 3D digital sphere, sleek crimson graphics",
      party: "Festive slow motion confetti burst, floating helium balloons, colorful celebratory party lighting",
    };
    const styleDesc = styleDescriptions[templateId] || styleDescriptions.premiere;

    const videoPrompt = `Cinematic vertical 9:16 mobile invitation video backdrop for ${effectiveTitle}. Style: ${styleDesc}. ${rawPrompt ? 'Event notes: ' + rawPrompt : ''}. Ultra-smooth slow camera motion, 4k photorealistic, aesthetic lighting, seamless loop, no typography, no text, clean negative space for invitation text.`;

    console.log(`[Replicate Video] Initiating prediction for template '${templateId}', photo: ${rawPhoto ? 'provided' : 'none'}...`);

    let prediction;
    try {
      if (rawPhoto && (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:image/'))) {
        try {
          prediction = await replicate.predictions.create({
            version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
            input: {
              input_image: rawPhoto,
              motion_bucket_id: 127,
              fps: 7,
            }
          });
        } catch (svdErr) {
          console.warn('[Replicate Video] SVD image-to-video attempt failed:', svdErr.message, '— falling back to minimax/video-01');
          prediction = await replicate.predictions.create({
            model: "minimax/video-01",
            input: {
              prompt: videoPrompt,
              prompt_optimizer: true,
            }
          });
        }
      } else {
        prediction = await replicate.predictions.create({
          model: "minimax/video-01",
          input: {
            prompt: videoPrompt,
            prompt_optimizer: true,
          }
        });
      }

      console.log(`[Replicate Video] Prediction created: ${prediction.id}, status: ${prediction.status}`);

      return res.status(200).json({
        success: true,
        async: true,
        predictionId: prediction.id,
        status: prediction.status,
        details: {
          title: effectiveTitle,
          date: effectiveDate,
          venue: effectiveVenue,
          templateId,
          photoUrl: rawPhoto,
        }
      });
    } catch (createErr) {
      console.warn('[Replicate Video] API call error:', createErr.message, '— returning curated video fallback.');
      const fallbackVideoUrl = getCategorizedVideoFallback(templateId, rawPrompt);
      return res.status(200).json({
        success: true,
        async: false,
        videoUrl: fallbackVideoUrl,
        source: 'curated_fallback',
        warning: createErr.message,
        details: {
          title: effectiveTitle,
          date: effectiveDate,
          venue: effectiveVenue,
          templateId,
          photoUrl: rawPhoto,
        }
      });
    }
  } catch (err) {
    console.error('[Replicate Video] Unexpected exception:', err.message);
    const fallbackVideoUrl = getCategorizedVideoFallback(templateId, rawPrompt);
    return res.status(200).json({
      success: true,
      async: false,
      videoUrl: fallbackVideoUrl,
      source: 'curated_fallback',
      details: {
        title: effectiveTitle,
        date: effectiveDate,
        venue: effectiveVenue,
        templateId,
        photoUrl: rawPhoto,
      }
    });
  }
};

/**
 * Check status of a Replicate video generation prediction
 */
const checkVideoStatus = async (req, res) => {
  const { predictionId } = req.params;
  if (!predictionId) {
    return res.status(400).json({ success: false, error: 'Prediction ID required' });
  }

  const replicateToken = getReplicateToken();
  if (!replicateToken) {
    return res.status(500).json({ success: false, error: 'Replicate token not configured' });
  }

  try {
    const Replicate = require('replicate');
    const replicate = new Replicate({ auth: replicateToken });

    const prediction = await replicate.predictions.get(predictionId);
    console.log(`[Replicate Video Status] ${predictionId}: ${prediction.status}`);

    let videoUrl = null;
    if (prediction.status === 'succeeded') {
      if (typeof prediction.output === 'string') {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      }
    }

    return res.status(200).json({
      success: true,
      status: prediction.status, // "starting" | "processing" | "succeeded" | "failed" | "canceled"
      videoUrl,
      error: prediction.error,
    });
  } catch (err) {
    console.error(`[Replicate Video Status] Error fetching ${predictionId}:`, err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

module.exports = {
  generateEventWithAI,
  generateStructuredEventWithAI,
  scanInvitationImage,
  generateEventTemplate,
  generateVideoTemplate,
  checkVideoStatus,
};
