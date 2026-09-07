const eventService = require("../services/event.service");
const emailService = require("../services/email.service");
const guestService = require("../services/guest.service");
const db = require("../config/db");
const prisma = require("../config/prisma");

/**
 * Get all events for the logged-in user
 * GET /api/events
 */
const getEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await eventService.findEventsByUserId(userId);
    return res.status(200).json({
      success: true,
      events
    });
  } catch (error) {
    console.error("Get Events Error:", error);
    return res.status(500).json({ error: "Server error retrieving events." });
  }
};

/**
 * Get a specific event by ID
 * GET /api/events/:id
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    console.error("Get Event By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving event details." });
  }
};

// Template styles matching frontend designs
const TEMPLATE_STYLES = {
  "tpl-birthday-maya": {
    imageUrl: "/assets/templates/birthday.jpg",
    accentColor: "#e07090",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#e07090",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-wedding-liam": {
    imageUrl: "/assets/templates/wedding.jpg",
    accentColor: "#9070c0",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#9070c0",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-corporate-launch": {
    imageUrl: "/assets/templates/corporate.jpg",
    accentColor: "#4080b0",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#4080b0",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-dinner-party": {
    imageUrl: "/assets/templates/dinner.jpg",
    accentColor: "#907030",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#907030",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-baby-shower": {
    imageUrl: "/assets/templates/babyshower.jpg",
    accentColor: "#4a9a4a",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#4a9a4a",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-charity-gala": {
    imageUrl: "/assets/templates/gala.jpg",
    accentColor: "#a07820",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#a07820",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-live-music": {
    imageUrl: "/assets/templates/music.jpg",
    accentColor: "#9970d0",
    backgroundColor: "#2D1B3D",
    textColor: "#FAF8F5",
    titleSize: 52,
    fontWeight: "700",
    fontFamily: "Inter",
    buttonColor: "#9970d0",
    buttonRadius: 16,
    textAlignment: "center",
  },
  "tpl-anniversary-james": {
    imageUrl: "/assets/templates/anniversary.jpg",
    accentColor: "#c06840",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#c06840",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-grad-gala": {
    imageUrl: "/assets/templates/graduation_gala.jpg",
    accentColor: "#d4af37",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#1e3c72",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-grad-class2026": {
    imageUrl: "/assets/templates/graduation_class_2026.jpg",
    accentColor: "#e67e22",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#d35400",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-grad-degree": {
    imageUrl: "/assets/templates/graduation_degree.jpg",
    accentColor: "#1abc9c",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#203a43",
    buttonRadius: 6,
    textAlignment: "center",
  },
  "tpl-comm-meetup": {
    imageUrl: "/assets/templates/community_meetup.jpg",
    accentColor: "#11998e",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#11998e",
    buttonRadius: 20,
    textAlignment: "center",
  },
  "tpl-comm-celebration": {
    imageUrl: "/assets/templates/community_celebration.jpg",
    accentColor: "#ff5e62",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#ff5e62",
    buttonRadius: 14,
    textAlignment: "center",
  },
  "tpl-comm-volunteer": {
    imageUrl: "/assets/templates/community_volunteer.jpg",
    accentColor: "#e91e63",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#e91e63",
    buttonRadius: 10,
    textAlignment: "center",
  },
  "tpl-net-professional": {
    imageUrl: "/assets/templates/networking_professional.jpg",
    accentColor: "#6f86d6",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#4e4376",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-net-founders": {
    imageUrl: "/assets/templates/networking_founders.jpg",
    accentColor: "#00c6ff",
    backgroundColor: "#2D1B3D",
    textColor: "#FAF8F5",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Inter",
    buttonColor: "#00c6ff",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-net-connections": {
    imageUrl: "/assets/templates/networking_connections.jpg",
    accentColor: "#3a7bd5",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#3a6073",
    buttonRadius: 10,
    textAlignment: "center",
  },
  ...require("../config/newTemplatesBackend").newTemplateStylesBackend
};

const { saveUploadedFile, saveBase64Image } = require("../utils/fileStorage");

/**
 * Create a new event
 * POST /api/events
 */
const createEvent = async (req, res) => {
  try {
    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (uploadedFile) {
      const uploadRes = await saveUploadedFile(uploadedFile, req, "event_cover");
      req.body.coverImage = uploadRes.url;
    } else {
      const rawImage =
        req.body.coverImage ||
        req.body.imageUrl ||
        req.body.thumbnail ||
        req.body.thumbnailUrl ||
        req.body.uploadedFileUrl ||
        req.body.previewUrl ||
        (req.body.designData && typeof req.body.designData === "object" ? req.body.designData.previewUrl : null);

      if (rawImage && typeof rawImage === "string") {
        const trimmedImg = rawImage.trim();
        if (trimmedImg.startsWith("blob:")) {
          // Discard temporary local blob URLs
          req.body.coverImage = null;
        } else if (trimmedImg.startsWith("data:") || trimmedImg.length > 500) {
          const base64Res = await saveBase64Image(trimmedImg, req, "event_cover");
          if (base64Res && base64Res.url) {
            req.body.coverImage = base64Res.url;
          }
        } else if (trimmedImg) {
          req.body.coverImage = trimmedImg;
        }
      }
    }

    const { title, eventDate, eventTime, venue, selectedTemplateId, templateId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({
        error: "Missing required fields. Please provide title, date, time, and venue."
      });
    }

    const effectiveTemplateId = selectedTemplateId || templateId;

    const newEvent = await eventService.createEvent({
      ...req.body,
      selectedTemplateId: effectiveTemplateId
    }, userId);

    // Synchronize resolved image URLs onto the response event object
    const resolvedCover = newEvent.coverImage || req.body.coverImage || null;
    const eventWithImages = {
      ...newEvent,
      coverImage: resolvedCover,
      imageUrl: resolvedCover,
      thumbnail: resolvedCover,
      thumbnailUrl: resolvedCover,
      uploadedFileUrl: resolvedCover,
    };

    // Automatically create invitation if templateId is provided or if uploaded cover image exists
    if (effectiveTemplateId) {
      const template = await prisma.template.findUnique({ where: { id: effectiveTemplateId } });
      if (template) {
        let design = {};
        try {
          design = JSON.parse(template.content);
        } catch (e) {
          console.error("Failed to parse template content:", e);
        }

        const style = TEMPLATE_STYLES[effectiveTemplateId] || {};

        await prisma.invitation.create({
          data: {
            eventId: newEvent.id,
            title: newEvent.title,
            subtitle: newEvent.venue || "TBD",
            mainText: design.description || newEvent.description || "Join us for an unforgettable experience filled with joy and celebration. Please RSVP using the button below to secure your spot.",
            message: design.description || newEvent.description || "",
            accentColor: style.accentColor || design.accentColor || "#5B5FEF",
            backgroundColor: style.backgroundColor || design.backgroundColor || "#FAF8F5",
            textColor: style.textColor || "#2D1B3D",
            titleSize: style.titleSize || 48,
            fontWeight: style.fontWeight || "700",
            fontFamily: style.fontFamily || "Playfair Display",
            textAlignment: style.textAlignment || "center",
            imageUrl: resolvedCover || style.imageUrl || null,
            buttonText: "RSVP Now",
            buttonColor: style.buttonColor || style.accentColor || "#5B5FEF",
            buttonRadius: style.buttonRadius || 12,
            status: "draft"
          }
        });
      }
    } else if (resolvedCover) {
      // Create initial invitation with custom uploaded image
      try {
        await prisma.invitation.create({
          data: {
            eventId: newEvent.id,
            title: newEvent.title,
            subtitle: newEvent.venue || "TBD",
            mainText: newEvent.description || "Join us for an unforgettable experience filled with joy and celebration. Please RSVP using the button below to secure your spot.",
            message: newEvent.description || "",
            accentColor: "#5B5FEF",
            backgroundColor: "#FAF8F5",
            textColor: "#2D1B3D",
            titleSize: 48,
            fontWeight: "700",
            fontFamily: "Playfair Display",
            textAlignment: "center",
            imageUrl: resolvedCover,
            buttonText: "RSVP Now",
            buttonColor: "#5B5FEF",
            buttonRadius: 12,
            status: "draft"
          }
        });
      } catch (invErr) {
        console.warn("Could not auto-create uploaded invitation:", invErr.message);
      }
    }

    // Log event creation
    const { createAuditLog } = require("../utils/auditLogger");
    await createAuditLog({
      userId,
      action: "EVENT_CREATED",
      eventId: newEvent.id
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: eventWithImages
    });
  } catch (error) {
    console.error("Create Event Error:", error);
    return res.status(500).json({ error: error.message || "Server error during event creation." });
  }
};

/**
 * Update an existing event
 * PUT /api/events/:id
 */
const updateEvent = async (req, res) => {
  try {
    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (uploadedFile) {
      const uploadRes = await saveUploadedFile(uploadedFile, req, "event_cover");
      req.body.coverImage = uploadRes.url;
    } else {
      const rawImage =
        req.body.coverImage ||
        req.body.imageUrl ||
        req.body.thumbnail ||
        req.body.thumbnailUrl ||
        req.body.uploadedFileUrl ||
        req.body.previewUrl ||
        (req.body.designData && typeof req.body.designData === "object" ? req.body.designData.previewUrl : null);

      if (rawImage && typeof rawImage === "string") {
        const trimmedImg = rawImage.trim();
        if (trimmedImg.startsWith("blob:")) {
          delete req.body.coverImage;
        } else if (trimmedImg.startsWith("data:") || trimmedImg.length > 500) {
          const base64Res = await saveBase64Image(trimmedImg, req, "event_cover");
          if (base64Res && base64Res.url) {
            req.body.coverImage = base64Res.url;
          }
        } else if (trimmedImg) {
          req.body.coverImage = trimmedImg;
        }
      }
    }

    const { id } = req.params;
    const { title, eventDate, eventTime, venue } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({
        error: "Missing required fields. Please provide title, date, time, and venue."
      });
    }

    const updatedEvent = await eventService.updateEvent(id, req.body, userId);
    if (!updatedEvent) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    const resolvedCover = updatedEvent.coverImage || req.body.coverImage || null;
    const eventWithImages = {
      ...updatedEvent,
      coverImage: resolvedCover,
      imageUrl: resolvedCover,
      thumbnail: resolvedCover,
      thumbnailUrl: resolvedCover,
      uploadedFileUrl: resolvedCover,
    };

    // Handle rsvpSettings if included in payload
    if (req.body.rsvpSettings) {
      try {
        let rsvpData = req.body.rsvpSettings;
        if (typeof rsvpData === "string") {
          rsvpData = JSON.parse(rsvpData);
        }
        if (typeof rsvpData === "object" && rsvpData !== null) {
          eventWithImages.rsvpSettings = await eventService.upsertRsvpSettings(id, rsvpData);
        }
      } catch (rsvpErr) {
        console.warn("Failed to parse/update rsvpSettings during event update:", rsvpErr.message);
      }
    } else {
      try {
        eventWithImages.rsvpSettings = await eventService.findRsvpSettingsByEventId(id);
      } catch (e) {
        // ignore
      }
    }

    // Log event update
    const { createAuditLog } = require("../utils/auditLogger");
    await createAuditLog({
      userId,
      action: "EVENT_UPDATED",
      eventId: updatedEvent.id
    });

    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      event: eventWithImages
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    return res.status(500).json({ error: "Server error during event update." });
  }
};

/**
 * Delete an event
 * DELETE /api/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await eventService.deleteEvent(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully."
    });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return res.status(500).json({ error: "Server error during event deletion." });
  }
};

/**
 * Get RSVP settings for an event
 * GET /api/events/:id/rsvp-settings
 */
const getRsvpSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    const rsvpSettings = await eventService.findRsvpSettingsByEventId(id);
    return res.status(200).json({
      success: true,
      rsvpSettings
    });
  } catch (error) {
    console.error("Get RSVP Settings Error:", error);
    return res.status(500).json({ success: false, error: "Server error retrieving RSVP settings." });
  }
};

/**
 * Update RSVP settings for an event
 * PUT /api/events/:id/rsvp-settings
 */
const updateRsvpSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    const updatedSettings = await eventService.upsertRsvpSettings(id, req.body);

    return res.status(200).json({
      success: true,
      message: "RSVP settings updated successfully.",
      rsvpSettings: updatedSettings
    });
  } catch (error) {
    console.error("Update RSVP Settings Error:", error);
    return res.status(500).json({ success: false, error: "Server error updating RSVP settings." });
  }
};

/**
 * Get Design settings for an event
 * GET /api/events/:id/design
 */
const getDesignSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    const designSettings = await eventService.findDesignSettingsByEventId(id);
    return res.status(200).json({
      success: true,
      design: designSettings,
      designSettings,
    });
  } catch (error) {
    console.error("Get Design Settings Error:", error);
    return res.status(500).json({ success: false, error: "Server error retrieving design settings." });
  }
};

/**
 * Update Design settings for an event
 * PUT /api/events/:id/design
 */
const updateDesignSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    const updatedSettings = await eventService.upsertDesignSettings(id, req.body);

    return res.status(200).json({
      success: true,
      message: "Design settings updated successfully.",
      design: updatedSettings,
      designSettings: updatedSettings,
    });
  } catch (error) {
    console.error("Update Design Settings Error:", error);
    return res.status(500).json({ success: false, error: "Server error updating design settings." });
  }
};


const sendEventInvitations = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      deliveryMethod = "email",
      options = {},
      testEmail,
      recipients: customRecipients,
      guestEmails,
      cardSnapshotUrl,
      snapshotUrl,
      cardImageBase64,
      snapshot,
    } = req.body || {};

    // Parse options whether sent at top-level or nested inside options object
    const reqOptions = typeof options === "object" && options !== null ? options : {};
    const parsedOptions = {
      personalizedGreeting: req.body?.personalizedGreeting !== undefined ? req.body.personalizedGreeting !== false : reqOptions.personalizedGreeting !== false,
      calendarLink: req.body?.calendarLink !== undefined ? req.body.calendarLink !== false : reqOptions.calendarLink !== false,
      mapLink: req.body?.mapLink !== undefined ? req.body.mapLink !== false : reqOptions.mapLink !== false,
      qrCode: req.body?.qrCode !== undefined ? req.body.qrCode !== false : reqOptions.qrCode !== false,
    };

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    // If delivery method is SMS or WhatsApp without testEmail or for UI demo
    if (deliveryMethod === "sms" || deliveryMethod === "whatsapp") {
      return res.status(200).json({
        success: true,
        message: `${deliveryMethod.toUpperCase()} invitation dispatch simulated successfully! (UI Preview)`,
        recipientCount: 0,
      });
    }

    // Resolve Frontend & Backend URLs
    const protocol = req.protocol || "http";
    const host = req.get("host");
    const isPlaceholder = (url) => !url || url.includes("your-backend.vercel.app") || url.includes("example.com");
    const trackingBaseUrl = (
      (!isPlaceholder(process.env.PUBLIC_BACKEND_URL) && process.env.PUBLIC_BACKEND_URL) ||
      (!isPlaceholder(process.env.BACKEND_URL) && process.env.BACKEND_URL) ||
      (host ? `${protocol}://${host}` : "http://localhost:5000")
    );
    const frontendUrl = (
      (!isPlaceholder(process.env.PUBLIC_APP_URL) && process.env.PUBLIC_APP_URL) ||
      (!isPlaceholder(process.env.NEXT_PUBLIC_APP_URL) && process.env.NEXT_PUBLIC_APP_URL) ||
      (!isPlaceholder(process.env.FRONTEND_URL) && process.env.FRONTEND_URL) ||
      "http://localhost:3000"
    );

    // Fetch associated invitation if available
    let invitation = null;
    try {
      const invRes = await db.query(
        `SELECT * FROM invitations WHERE event_id = $1 LIMIT 1`,
        [id]
      );
      if (invRes.rows && invRes.rows[0]) {
        invitation = invRes.rows[0];
      }
    } catch (e) {
      console.warn("[EventController] No invitation record found, using event details:", e.message);
    }

    let recipients = [];
    let isTest = false;

    if (testEmail && typeof testEmail === "string" && testEmail.trim()) {
      isTest = true;
      const cleanTestEmail = testEmail.trim().toLowerCase();
      let testGuest = null;
      try {
        const guestQuery = await db.query(
          `SELECT id, name, email FROM guests WHERE event_id = $1 AND LOWER(email) = $2 LIMIT 1`,
          [id, cleanTestEmail]
        );
        if (guestQuery.rows && guestQuery.rows.length > 0) {
          testGuest = guestQuery.rows[0];
        } else {
          const insertQuery = await db.query(
            `INSERT INTO guests (id, event_id, name, email, status, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'invited', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id, name, email`,
            [id, req.user.name || "Test Guest", cleanTestEmail]
          );
          testGuest = insertQuery.rows[0];
        }
      } catch (err) {
        console.warn("[EventController] Could not find or create test guest in DB:", err.message);
      }

      recipients = [
        {
          guestId: testGuest?.id || null,
          name: req.user.name || testGuest?.name || "Test Guest",
          email: cleanTestEmail,
        }
      ];
    } else if (customRecipients || guestEmails) {
      // Direct recipient emails provided by mobile app or client payload
      const rawList = []
        .concat(customRecipients || [])
        .concat(guestEmails || []);

      const parsedEmails = rawList
        .flatMap((item) => {
          if (typeof item === "string") return item.split(/[\s,;\n]+/);
          if (item && typeof item === "object" && item.email) return [item.email];
          return [];
        })
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes("@"));

      if (parsedEmails.length > 0) {
        const resolvedList = [];
        for (const em of parsedEmails) {
          try {
            const fRes = await db.query(
              `SELECT id, name, email FROM guests WHERE event_id = $1 AND LOWER(email) = $2 LIMIT 1`,
              [id, em]
            );
            if (fRes.rows.length > 0) {
              resolvedList.push({
                guestId: fRes.rows[0].id,
                name: fRes.rows[0].name || "",
                email: em,
              });
            } else {
              const defName = em.split("@")[0] || "Guest";
              const insRes = await db.query(
                `INSERT INTO guests (id, event_id, name, email, status, created_at, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, 'invited', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING id, name, email`,
                [id, defName, em]
              );
              resolvedList.push({
                guestId: insRes.rows[0]?.id || null,
                name: defName,
                email: em,
              });
            }
          } catch (e) {
            resolvedList.push({ guestId: null, name: "", email: em });
          }
        }
        recipients = resolvedList;
      }
    }

    if (!isTest && recipients.length === 0) {
      // Fetch all guests for this event from database
      const guestResult = await guestService.findGuestsByUserId(userId, "", id);
      const allGuests = guestResult?.guests || [];
      recipients = allGuests
        .filter((g) => g.email && g.email.includes("@"))
        .map((g) => ({
          guestId: g.id,
          name: g.name,
          email: g.email.trim(),
        }));

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No guests with a valid email address were found for this event. Please add guests in the guest list before sending invitations.",
        });
      }
    }

    // Send invitations via emailService (Nodemailer)
    const sendResult = await emailService.sendInvitationEmails({
      recipients,
      invitation,
      event,
      senderName: req.user.name || req.user.email,
      frontendUrl,
      trackingBaseUrl,
      snapshotUrl,
      cardSnapshotUrl,
      cardImageBase64,
      snapshot,
      options: parsedOptions,
    });

    // If real send (not test), update guests status to 'invited'
    if (!isTest && recipients.length > 0) {
      try {
        const guestIds = recipients.map((r) => r.guestId).filter(Boolean);
        if (guestIds.length > 0) {
          await db.query(
            `UPDATE guests SET status = 'invited', updated_at = NOW() WHERE event_id = $1 AND id = ANY($2::uuid[])`,
            [id, guestIds]
          );
        }
        // Update event status to published if it was draft
        await db.query(
          `UPDATE events SET status = 'published', updated_at = NOW() WHERE id = $1 AND status = 'draft'`,
          [id]
        );
      } catch (dbErr) {
        console.warn("[EventController] Error updating guest/event status:", dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: isTest
        ? `Test invitation successfully sent to ${testEmail}!`
        : `Invitations successfully sent to ${sendResult.recipientCount} recipient(s)!`,
      recipientCount: sendResult.recipientCount,
      previewUrl: sendResult.previewUrl || null,
    });
  } catch (error) {
    console.error("[EventController] Send Invitations Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to dispatch email invitations.",
    });
  }
};

/**
 * Get event reminders
 * GET /api/events/:id/reminders
 */
const getEventReminders = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    let reminders = await eventService.findRemindersByEventId(id);

    // If no reminders exist yet, return default reminder templates
    if (!reminders || reminders.length === 0) {
      reminders = eventService.DEFAULT_EVENT_REMINDERS.map((r) => ({
        ...r,
        eventId: id,
      }));
    }

    return res.status(200).json({
      success: true,
      reminders,
    });
  } catch (error) {
    console.error("Get Event Reminders Error:", error);
    return res.status(500).json({ success: false, error: "Server error retrieving event reminders." });
  }
};

/**
 * Update/overwrite event reminders
 * PUT /api/events/:id/reminders
 */
const updateEventReminders = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const reminders = Array.isArray(req.body) ? req.body : (req.body.reminders || []);

    // Verify ownership
    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found or unauthorized access." });
    }

    // Validation
    for (const item of reminders) {
      if (typeof item.daysBefore !== "undefined" && isNaN(Number(item.daysBefore))) {
        return res.status(400).json({ success: false, error: "Invalid daysBefore value in reminders." });
      }
      if (item.sendVia && !["Email", "SMS", "WhatsApp"].includes(item.sendVia)) {
        return res.status(400).json({ success: false, error: "sendVia must be 'Email', 'SMS', or 'WhatsApp'." });
      }
    }

    const updatedReminders = await eventService.updateRemindersForEvent(id, reminders);

    return res.status(200).json({
      success: true,
      message: "Reminders updated successfully.",
      reminders: updatedReminders,
    });
  } catch (error) {
    console.error("Update Event Reminders Error:", error);
    return res.status(500).json({ success: false, error: "Server error updating event reminders." });
  }
};

/**
 * Get attendance commitment metrics and no-shows for an event
 * GET /api/events/:eventId/attendance-commitment
 */
const getAttendanceCommitment = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required." });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      return res.status(400).json({ success: false, error: "Invalid event ID format." });
    }

    // Verify event existence and ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        eventDate: true,
        eventTime: true,
        createdBy: true,
      },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found." });
    }

    if (event.createdBy !== userId) {
      return res.status(403).json({ success: false, error: "Access denied. You do not own this event." });
    }

    // Get user guarantee setting for guaranteeAmount
    const guaranteeSetting = await prisma.attendanceGuaranteeSetting.findUnique({
      where: { userId },
    });
    const configuredGuaranteeAmount = guaranteeSetting?.guaranteeAmount
      ? parseFloat(guaranteeSetting.guaranteeAmount)
      : 25.0;

    // Query guests for eventId where rsvpStatus IN ('attending', 'yes', 'confirmed') including relation checkIns
    const attendingGuests = await prisma.guest.findMany({
      where: {
        eventId,
        OR: [
          { rsvpStatus: { in: ["attending", "yes", "confirmed", "ATTENDING", "YES", "CONFIRMED", "Confirmed", "Attending"] } },
          { status: { in: ["confirmed", "attending", "CONFIRMED", "ATTENDING"] } },
        ],
      },
      include: {
        checkIns: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Check if event has started
    let eventStartDateTime = new Date(event.eventDate);
    if (event.eventTime) {
      const timeStr = typeof event.eventTime === "string"
        ? event.eventTime
        : event.eventTime instanceof Date
          ? event.eventTime.toTimeString().split(" ")[0]
          : null;
      if (timeStr) {
        const parts = timeStr.split(":");
        if (parts.length >= 2) {
          eventStartDateTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
      }
    }
    const hasEventStarted = eventStartDateTime <= new Date();

    const totalConfirmed = attendingGuests.length;
    const attendedSafe = attendingGuests.filter((g) => g.checkIns && g.checkIns.length > 0).length;

    // Attending guests with zero check-in records
    const unCheckedInGuests = attendingGuests.filter((g) => !g.checkIns || g.checkIns.length === 0);
    // noShows: Attending guests with zero check-in records after the event starts
    const noShowsCount = hasEventStarted ? unCheckedInGuests.length : 0;

    const waivedCount = attendingGuests.filter((g) => g.guaranteeStatus?.toUpperCase() === "WAIVED").length;
    const chargedCount = attendingGuests.filter((g) => g.guaranteeStatus?.toUpperCase() === "CHARGED").length;
    const pendingCount = attendingGuests.filter(
      (g) => !g.guaranteeStatus || g.guaranteeStatus?.toUpperCase() === "PENDING"
    ).length;

    const reviewWindowDays = guaranteeSetting?.reviewWindowDays || 7;

    const noShowsList = unCheckedInGuests.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone || null,
      guaranteeStatus: g.guaranteeStatus || "PENDING",
      guaranteeAmount: configuredGuaranteeAmount,
      rsvpAt: g.respondedAt || g.createdAt,
      isEventStarted: hasEventStarted,
      penaltyNoticeSentAt: g.penaltyNoticeSentAt || null,
      guaranteeChargedAt: g.guaranteeChargedAt || null,
      guaranteeWaivedAt: g.guaranteeWaivedAt || null,
      eventDate: event.eventDate,
      eventTitle: event.title,
      reviewWindowDays,
    }));

    return res.status(200).json({
      success: true,
      hasEventStarted,
      metrics: {
        totalConfirmed,
        attendedSafe,
        noShows: noShowsCount,
        waivedCount,
        chargedCount,
        pendingCount,
      },
      noShows: noShowsList,
    });
  } catch (error) {
    console.error("Get Attendance Commitment Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving attendance commitment metrics.",
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getRsvpSettings,
  updateRsvpSettings,
  getDesignSettings,
  updateDesignSettings,
  sendEventInvitations,
  getEventReminders,
  updateEventReminders,
  getAttendanceCommitment,
};

