const invitationService = require("../services/invitation.service");
const eventService = require("../services/event.service");
const guestService = require("../services/guest.service");
const emailService = require("../services/email.service");
const { saveBase64Image } = require("../utils/fileStorage");

// Helper to validate and sanitize colors (hex, rgb/rgba, hsl/hsla, gradients, named colors)
const isValidHexColor = (color) => {
  if (!color) return false;
  if (typeof color === "object") return true;
  if (typeof color !== "string") return false;
  const trimmed = color.trim();
  return (
    trimmed.startsWith("#") ||
    trimmed.startsWith("rgb") ||
    trimmed.startsWith("hsl") ||
    trimmed.includes("gradient") ||
    /^[a-zA-Z]+$/.test(trimmed)
  );
};

const sanitizeColor = (color, defaultColor = "#5B5FEF") => {
  if (!color) return defaultColor;
  if (typeof color === "object") {
    color = color.hex || color.value || color.style || color.color || defaultColor;
  }
  if (typeof color !== "string") return defaultColor;
  const trimmed = color.trim();
  if (isValidHexColor(trimmed)) return trimmed;
  return defaultColor;
};

// Safe Prisma error handler
const handlePrismaError = (error, res, defaultMessage) => {
  if (error.code === "P2021") {
    console.error("Prisma Error P2021: Invitations database table is missing. Apply the pending Prisma migration.");
    return res.status(500).json({
      success: false,
      message: "Unable to load invitation."
    });
  }
  
  if (error.code === "P2022") {
    console.error("Prisma Error P2022: Column does not exist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load invitation."
    });
  }

  if (error.code === "P2002") {
    console.error("Prisma Error P2002: Unique constraint violation:", error.message);
    return res.status(400).json({
      success: false,
      message: "A record with this unique value already exists."
    });
  }

  if (error.code === "P2003") {
    console.error("Prisma Error P2003: Foreign key constraint failed:", error.message);
    return res.status(400).json({
      success: false,
      message: "Invalid event or reference."
    });
  }

  if (error.code === "P2025") {
    console.error("Prisma Error P2025: Record not found.");
    return res.status(404).json({
      success: false,
      message: "Invitation not found."
    });
  }

  console.error("Database Error:", error.message || error);
  return res.status(500).json({
    success: false,
    message: defaultMessage || "Server error occurred."
  });
};

/**
 * Get all invitations for the logged-in user
 * GET /api/invitations
 */
const getInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const invitations = await invitationService.findInvitationsByUserId(userId);
    return res.status(200).json({
      success: true,
      invitations
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error retrieving invitations.");
  }
};

/**
 * Get a specific invitation by ID
 * GET /api/invitations/:id
 */
const getInvitationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const invitation = await invitationService.findInvitationById(id, userId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      invitation
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error retrieving invitation details.");
  }
};

/**
 * Get invitation by event ID
 * GET /api/events/:eventId/invitation
 */
const getInvitationByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    const invitation = await invitationService.findInvitationByEventId(eventId, userId);
    return res.status(200).json({
      success: true,
      invitation
    });
  } catch (error) {
    return handlePrismaError(error, res, "Unable to load invitation.");
  }
};

/**
 * Create a new invitation
 * POST /api/invitations
 */
const createInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
  const {
      id,
      eventId,
      title,
      subtitle,
      mainText,
      message,
      accentColor,
      backgroundColor,
      textColor,
      titleSize,
      fontWeight,
      fontFamily,
      textAlignment,
      imageUrl,
      buttonText,
      buttonColor,
      buttonRadius,
      status,
      // Event detail overrides
      eventTitle,
      eventDate,
      eventTime,
      eventVenue,
    } = req.body;

    // Validate required fields
    if (!eventId) {
      return res.status(400).json({ error: "Event is required." });
    }
    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Title is required." });
    }

    // Verify user owns the event
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    // Validate and sanitize Title
    let cleanTitle = title;
    if (!cleanTitle || typeof cleanTitle !== "string" || cleanTitle.trim() === "") {
      cleanTitle = eventTitle || (event ? `Invitation to ${event.title}` : "Party Invitation");
    }

    // Sanitize Title Size (clamped 16 - 120)
    let cleanTitleSize = titleSize !== undefined ? parseInt(titleSize, 10) : 48;
    if (isNaN(cleanTitleSize)) cleanTitleSize = 48;
    cleanTitleSize = Math.max(16, Math.min(120, cleanTitleSize));

    // Sanitize Colors & Button
    const cleanAccentColor = sanitizeColor(accentColor, "#5B5FEF");
    const cleanBackgroundColor = sanitizeColor(backgroundColor, "#FAF8F5");
    const cleanTextColor = sanitizeColor(textColor, "#1A1118");
    const cleanButtonColor = sanitizeColor(buttonColor, cleanAccentColor);
    let cleanButtonRadius = buttonRadius !== undefined ? parseInt(buttonRadius, 10) : 8;
    if (isNaN(cleanButtonRadius)) cleanButtonRadius = 8;

    const payloadId = id || `inv_${Math.random().toString(36).substr(2, 9)}`;

    let cleanImageUrl = imageUrl;
    if (imageUrl && typeof imageUrl === "string") {
      const trimmed = imageUrl.trim();
      if (trimmed.startsWith("blob:")) {
        cleanImageUrl = null;
      } else if (trimmed.startsWith("data:") || trimmed.length > 500) {
        const uploadRes = await saveBase64Image(trimmed, req, "invitation_cover");
        if (uploadRes) {
          cleanImageUrl = uploadRes.url;
        }
      }
    }

    // Verify if invitation already exists for this event — if so, gracefully update it instead of throwing 400
    const existing = await invitationService.findInvitationByEventId(eventId, userId);
    if (existing) {
      const updated = await invitationService.updateInvitation(
        existing.id,
        {
          title: cleanTitle,
          subtitle,
          mainText,
          message: message !== undefined ? message : existing.message,
          accentColor: cleanAccentColor,
          backgroundColor: cleanBackgroundColor,
          textColor: cleanTextColor,
          titleSize: cleanTitleSize,
          fontWeight: fontWeight || existing.fontWeight,
          fontFamily: fontFamily || existing.fontFamily,
          textAlignment: textAlignment || existing.textAlignment,
          imageUrl: cleanImageUrl !== undefined ? cleanImageUrl : existing.imageUrl,
          buttonText: buttonText || existing.buttonText,
          buttonColor: cleanButtonColor,
          buttonRadius: cleanButtonRadius,
          status: status || existing.status,
          eventTitle: eventTitle !== undefined ? eventTitle : existing.eventTitle,
          eventDate: eventDate !== undefined ? eventDate : existing.eventDate,
          eventTime: eventTime !== undefined ? eventTime : existing.eventTime,
          eventVenue: eventVenue !== undefined ? eventVenue : existing.eventVenue,
        },
        userId
      );
      return res.status(200).json({
        success: true,
        message: "Invitation updated successfully.",
        invitation: updated,
      });
    }

    const newInvitation = await invitationService.createInvitation(
      {
        id: payloadId,
        eventId,
        title: cleanTitle,
        subtitle,
        mainText,
        message,
        accentColor: cleanAccentColor,
        backgroundColor: cleanBackgroundColor,
        textColor: cleanTextColor,
        titleSize: cleanTitleSize,
        fontWeight: fontWeight || "normal",
        fontFamily: fontFamily || "sans-serif",
        textAlignment: textAlignment || "center",
        imageUrl: cleanImageUrl,
        buttonText: buttonText || "RSVP Now",
        buttonColor: cleanButtonColor,
        buttonRadius: cleanButtonRadius,
        status: status || "draft",
        eventTitle: eventTitle || null,
        eventDate: eventDate || null,
        eventTime: eventTime || null,
        eventVenue: eventVenue || null,
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: "Invitation created successfully.",
      invitation: newInvitation
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error during invitation creation.");
  }
};

/**
 * Update an existing invitation
 * PUT /api/invitations/:id
 */
const updateInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      title,
      subtitle,
      mainText,
      message,
      accentColor,
      backgroundColor,
      textColor,
      titleSize,
      fontWeight,
      fontFamily,
      textAlignment,
      imageUrl,
      buttonText,
      buttonColor,
      buttonRadius,
      status,
      // Event detail overrides
      eventTitle,
      eventDate,
      eventTime,
      eventVenue,
    } = req.body;

    // Verify user owns the invitation
    const existingInvitation = await invitationService.findInvitationById(id, userId);
    if (!existingInvitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    // Validate and sanitize Title
    let cleanTitle = title;
    if (!cleanTitle || typeof cleanTitle !== "string" || cleanTitle.trim() === "") {
      cleanTitle = existingInvitation.title || "Party Invitation";
    }

    // Sanitize Title Size (clamped 16 - 120)
    let cleanTitleSize = titleSize !== undefined ? parseInt(titleSize, 10) : existingInvitation.titleSize;
    if (isNaN(cleanTitleSize)) cleanTitleSize = existingInvitation.titleSize || 48;
    cleanTitleSize = Math.max(16, Math.min(120, cleanTitleSize));

    // Sanitize Colors & Button
    const cleanAccentColor = sanitizeColor(accentColor, existingInvitation.accentColor || "#5B5FEF");
    const cleanBackgroundColor = sanitizeColor(backgroundColor, existingInvitation.backgroundColor || "#FAF8F5");
    const cleanTextColor = sanitizeColor(textColor, existingInvitation.textColor || "#1A1118");
    const cleanButtonColor = sanitizeColor(buttonColor, existingInvitation.buttonColor || cleanAccentColor);
    let cleanButtonRadius = buttonRadius !== undefined ? parseInt(buttonRadius, 10) : existingInvitation.buttonRadius;
    if (isNaN(cleanButtonRadius)) cleanButtonRadius = existingInvitation.buttonRadius ?? 8;

    let cleanImageUrl = imageUrl;
    if (imageUrl && typeof imageUrl === "string") {
      const trimmed = imageUrl.trim();
      if (trimmed.startsWith("blob:")) {
        cleanImageUrl = existingInvitation.imageUrl || null;
      } else if (trimmed.startsWith("data:") || trimmed.length > 500) {
        const uploadRes = await saveBase64Image(trimmed, req, "invitation_cover");
        if (uploadRes) {
          cleanImageUrl = uploadRes.url;
        }
      }
    }

    const updatedInvitation = await invitationService.updateInvitation(
      id,
      {
        title,
        subtitle,
        mainText,
        message: message !== undefined ? message : existingInvitation.message,
        accentColor: accentColor || existingInvitation.accentColor,
        backgroundColor: backgroundColor || existingInvitation.backgroundColor,
        textColor: textColor || existingInvitation.textColor,
        titleSize: titleSize !== undefined ? titleSize : existingInvitation.titleSize,
        fontWeight: fontWeight || existingInvitation.fontWeight,
        fontFamily: fontFamily || existingInvitation.fontFamily,
        textAlignment: textAlignment || existingInvitation.textAlignment,
        imageUrl: cleanImageUrl !== undefined ? cleanImageUrl : existingInvitation.imageUrl,
        buttonText: buttonText || existingInvitation.buttonText,
        buttonColor: buttonColor || existingInvitation.buttonColor,
        buttonRadius: buttonRadius !== undefined ? buttonRadius : existingInvitation.buttonRadius,
        status: status || existingInvitation.status,
        // Persist event detail overrides (null means clear, undefined means keep existing)
        eventTitle: eventTitle !== undefined ? eventTitle : existingInvitation.eventTitle,
        eventDate: eventDate !== undefined ? eventDate : existingInvitation.eventDate,
        eventTime: eventTime !== undefined ? eventTime : existingInvitation.eventTime,
        eventVenue: eventVenue !== undefined ? eventVenue : existingInvitation.eventVenue,
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Invitation updated successfully.",
      invitation: updatedInvitation
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error during invitation update.");
  }
};

/**
 * Delete an invitation
 * DELETE /api/invitations/:id
 */
const deleteInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await invitationService.deleteInvitation(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      message: "Invitation deleted successfully."
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error during invitation deletion.");
  }
};

// Helper to robustly parse email addresses from string or array input
const parseRecipientEmails = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap(item => parseRecipientEmails(item));
  }
  if (typeof input === "string") {
    return input
      .split(/[\s,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes("@") && e.includes("."));
  }
  if (typeof input === "object" && input !== null && input.email) {
    return parseRecipientEmails(input.email);
  }
  return [];
};

// Helper to ensure all recipient emails exist as guests and record sent_at
const ensureGuestsForEvent = async (eventId, emails, existingGuestIds = []) => {
  const resultGuests = [];
  const db = require("../config/db");

  // If specific guest IDs provided, fetch them first
  if (Array.isArray(existingGuestIds) && existingGuestIds.length > 0) {
    try {
      const res = await db.query(
        `SELECT id, name, email, event_id FROM guests WHERE event_id = $1 AND id = ANY($2::uuid[])`,
        [eventId, existingGuestIds]
      );
      for (const row of res.rows) {
        resultGuests.push({
          id: row.id,
          email: row.email.toLowerCase(),
          name: row.name,
        });
      }
    } catch (err) {
      console.warn("[InvitationController] Error querying existing guest IDs:", err.message);
    }
  }

  // For emails not yet in resultGuests, find or create
  for (const email of emails) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) continue;

    if (resultGuests.some(g => g.email === cleanEmail)) continue;

    try {
      const findRes = await db.query(
        `SELECT id, name, email FROM guests WHERE event_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [eventId, cleanEmail]
      );

      if (findRes.rows.length > 0) {
        resultGuests.push({
          id: findRes.rows[0].id,
          email: cleanEmail,
          name: findRes.rows[0].name,
        });
      } else if (eventId) {
        const defaultName = cleanEmail.split("@")[0] || "Guest";
        const insertRes = await db.query(
          `INSERT INTO guests (id, event_id, name, email, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'invited', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id, name, email`,
          [eventId, defaultName, cleanEmail]
        );
        if (insertRes.rows[0]) {
          resultGuests.push({
            id: insertRes.rows[0].id,
            email: cleanEmail,
            name: defaultName,
          });
        }
      }
    } catch (err) {
      console.warn(`[InvitationController] Error checking/creating guest ${cleanEmail}:`, err.message);
    }
  }

  // Update sent_at timestamp for all resolved guests
  if (resultGuests.length > 0) {
    const guestIds = resultGuests.map(g => g.id).filter(Boolean);
    if (guestIds.length > 0) {
      try {
        await db.query(
          `UPDATE guests
           SET sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::uuid[])`,
          [guestIds]
        );
      } catch (err) {
        console.warn("[InvitationController] Error updating sent_at on guests:", err.message);
      }
    }
  }

  return resultGuests;
};

/**
 * Send invitation via email
 * POST /api/invitations/:id/send
 */
const sendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { recipients, guestEmails, cardSnapshotUrl, snapshotUrl, cardImageBase64, snapshot, guestIds } = req.body || {};

    const invitation = await invitationService.findInvitationById(id, userId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    let event = null;
    if (invitation.eventId) {
      try {
        event = await eventService.findEventById(invitation.eventId, userId);
      } catch (err) {
        console.warn("[InvitationController] Could not fetch event details:", err.message);
      }
    }

    // Resolve snapshot image URL (convert Base64 if needed) for email dispatch
    const rawSnapshot = snapshot || cardImageBase64 || snapshotUrl || cardSnapshotUrl || null;
    let resolvedSnapshotUrl = null;
    let resolvedBase64 = null;

    console.log(`[InvitationController] Dispatching invitation ID: ${id}, imageUrl: ${invitation.imageUrl || "(none)"}, snapshot payload size: ${rawSnapshot ? `${(rawSnapshot.length / 1024).toFixed(1)} KB` : "0 KB"}`);

    if (rawSnapshot && typeof rawSnapshot === "string") {
      const trimmed = rawSnapshot.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/uploads/")) {
        resolvedSnapshotUrl = trimmed;
      } else if (trimmed.startsWith("data:") || trimmed.length > 300) {
        // Always upload Base64 to file storage first — never pass raw Base64 to email template
        try {
          const uploadRes = await saveBase64Image(trimmed, req, "invitation_snapshot");
          if (uploadRes && uploadRes.url) {
            resolvedSnapshotUrl = uploadRes.url;
            console.log("[InvitationController] Saved snapshot Base64 to static URL:", uploadRes.url);
          }
        } catch (uploadErr) {
          console.warn("[InvitationController] Could not save Base64 snapshot to file storage:", uploadErr.message);
          console.warn("[InvitationController] ⚠️  Email will use themed fallback banner instead of card image.");
        }
      }
    }

    // Determine target recipient emails
    let targetEmails = [];

    // 1. Direct recipient array or string from request body
    if (recipients) {
      targetEmails = parseRecipientEmails(recipients);
    }
    if (targetEmails.length === 0 && guestEmails) {
      targetEmails = parseRecipientEmails(guestEmails);
    }

    // Extract explicit guest IDs if provided directly or embedded inside recipient objects
    const explicitGuestIds = [
      ...(Array.isArray(guestIds) ? guestIds : []),
      ...(Array.isArray(recipients)
        ? recipients
            .filter((r) => r && typeof r === "object" && (r.guestId || r.id))
            .map((r) => r.guestId || r.id)
        : []),
    ].filter(Boolean);

    // 2. Fallback to event guest list if no explicit recipients supplied
    if (targetEmails.length === 0 && invitation.eventId) {
      try {
        const guests = await guestService.findGuestsByUserId(userId, "", invitation.eventId);
        if (Array.isArray(guests)) {
          if (explicitGuestIds.length > 0) {
            targetEmails = guests
              .filter((g) => explicitGuestIds.includes(g.id))
              .map((g) => (g.email ? g.email.trim().toLowerCase() : ""))
              .filter((e) => e && e.includes("@"));
          } else {
            targetEmails = guests
              .map((g) => (g.email ? g.email.trim().toLowerCase() : ""))
              .filter((e) => e && e.includes("@"));
          }
        }
      } catch (err) {
        console.warn("[InvitationController] Error fetching guests for event:", err.message);
      }
    }

    if (targetEmails.length === 0) {
      return res.status(400).json({
        error: "No valid recipient email address found. Please enter valid guest email address(es) (e.g. swaraswn@gmail.com) or add guests to your event."
      });
    }

    // Ensure guests are created/found in database and sent_at is recorded
    const resolvedGuests = await ensureGuestsForEvent(invitation.eventId, targetEmails, explicitGuestIds);

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

    // Build effective event: merge invitation-level overrides onto the fetched event
    // so the email always reflects what the user edited in accordion 5, not stale DB values
    const effectiveEvent = event ? {
      ...event,
      title: invitation.eventTitle || event.title,
      eventDate: invitation.eventDate || event.eventDate,
      eventTime: invitation.eventTime || event.eventTime,
      venue: invitation.eventVenue || event.venue,
    } : {
      title: invitation.eventTitle || "",
      eventDate: invitation.eventDate || "",
      eventTime: invitation.eventTime || "",
      venue: invitation.eventVenue || "",
    };

    // Send emails via Nodemailer service with personalized tracking pixel and CID inline card image
    // Pass both the resolved URL and the raw snapshot data so the email service can
    // create CID inline attachments directly from Base64 when public URLs are unavailable
    const sendResult = await emailService.sendInvitationEmails({
      recipients: resolvedGuests.length > 0 ? resolvedGuests : targetEmails,
      invitation,
      event: effectiveEvent,
      senderName: req.user.name || req.user.email,
      frontendUrl,
      snapshotUrl: resolvedSnapshotUrl,
      cardSnapshotUrl: cardSnapshotUrl || snapshotUrl,
      cardImageBase64: (rawSnapshot && rawSnapshot.startsWith && (rawSnapshot.startsWith("data:") || rawSnapshot.length > 300)) ? rawSnapshot : cardImageBase64,
      snapshot: rawSnapshot,
      trackingBaseUrl,
    });

    // Mark status as published
    await invitationService.updateInvitation(id, { ...invitation, status: "published" }, userId);

    return res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${sendResult.recipientCount} recipient(s)!`,
      recipientCount: sendResult.recipientCount,
      previewUrl: sendResult.previewUrl || null,
      snapshotUrl: resolvedSnapshotUrl,
    });
  } catch (error) {
    console.error("[InvitationController] Error sending invitation:", error);
    return res.status(500).json({
      error: error.message || "Failed to dispatch invitation email. Please check server settings."
    });
  }
};

/**
 * Send invitation to specific guests
 * POST /api/invitations/send
 */
const sendInvitationToGuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { invitationId, eventId, guestIds, recipients, cardSnapshotUrl, snapshotUrl, cardImageBase64, snapshot } = req.body || {};

    let targetInvitationId = invitationId;
    if (!targetInvitationId && eventId) {
      const existing = await invitationService.findInvitationByEventId(eventId, userId);
      if (existing) {
        targetInvitationId = existing.id;
      } else {
        try {
          const autoInvite = await invitationService.createInvitation(
            {
              eventId,
              title: req.body?.title || req.body?.eventDetails?.title || "Event Invitation",
              imageUrl: req.body?.snapshotUrl || req.body?.cardSnapshotUrl || null,
              status: "draft",
            },
            userId
          );
          targetInvitationId = autoInvite.id;
        } catch (autoErr) {
          console.warn("[InvitationController] Could not auto-create invitation:", autoErr.message);
        }
      }
    }

    if (!targetInvitationId) {
      return res.status(400).json({ error: "invitationId or eventId is required to send invitations." });
    }

    const invitation = await invitationService.findInvitationById(targetInvitationId, userId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    let event = null;
    if (invitation.eventId) {
      try {
        event = await eventService.findEventById(invitation.eventId, userId);
      } catch (err) {
        console.warn("[InvitationController] Could not fetch event details:", err.message);
      }
    }

    // Resolve snapshot image URL (convert Base64 if needed) for email dispatch
    const rawSnapshot = snapshot || cardImageBase64 || snapshotUrl || cardSnapshotUrl || null;
    let resolvedSnapshotUrl = null;

    console.log(`[InvitationController] Dispatching to guests for invitation ID: ${invitationId}, imageUrl: ${invitation.imageUrl || "(none)"}, snapshot payload size: ${rawSnapshot ? `${(rawSnapshot.length / 1024).toFixed(1)} KB` : "0 KB"}`);

    if (rawSnapshot && typeof rawSnapshot === "string") {
      const trimmed = rawSnapshot.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/uploads/")) {
        resolvedSnapshotUrl = trimmed;
      } else if (trimmed.startsWith("data:") || trimmed.length > 300) {
        // Always upload Base64 to file storage first — never pass raw Base64 to email template
        try {
          const uploadRes = await saveBase64Image(trimmed, req, "invitation_snapshot");
          if (uploadRes && uploadRes.url) {
            resolvedSnapshotUrl = uploadRes.url;
            console.log("[InvitationController] Saved snapshot Base64 to static URL:", uploadRes.url);
          }
        } catch (uploadErr) {
          console.warn("[InvitationController] Could not save Base64 snapshot to file storage:", uploadErr.message);
          console.warn("[InvitationController] ⚠️  Email will use themed fallback banner instead of card image.");
        }
      }
    }

    let targetEmails = [];
    if (recipients) {
      targetEmails = parseRecipientEmails(recipients);
    }

    if (targetEmails.length === 0 && invitation.eventId) {
      const guests = await guestService.findGuestsByUserId(userId, "", invitation.eventId);
      if (Array.isArray(guests)) {
        if (Array.isArray(guestIds) && guestIds.length > 0) {
          targetEmails = guests.filter(g => guestIds.includes(g.id)).map(g => g.email ? g.email.trim().toLowerCase() : "").filter(e => e && e.includes("@"));
        } else {
          targetEmails = guests.map(g => g.email ? g.email.trim().toLowerCase() : "").filter(e => e && e.includes("@"));
        }
      }
    }

    if (targetEmails.length === 0) {
      return res.status(400).json({ error: "No valid guest recipient emails found to send." });
    }

    // Ensure guests are created/found in database and sent_at is recorded
    const resolvedGuests = await ensureGuestsForEvent(invitation.eventId, targetEmails, guestIds);

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

    // Build effective event: merge invitation-level overrides onto the fetched event
    const effectiveEvent = event ? {
      ...event,
      title: invitation.eventTitle || event.title,
      eventDate: invitation.eventDate || event.eventDate,
      eventTime: invitation.eventTime || event.eventTime,
      venue: invitation.eventVenue || event.venue,
    } : {
      title: invitation.eventTitle || "",
      eventDate: invitation.eventDate || "",
      eventTime: invitation.eventTime || "",
      venue: invitation.eventVenue || "",
    };

    // Pass both resolved URL and raw snapshot data so email service can create
    // CID inline attachments directly from Base64 when public URLs are unavailable
    const sendResult = await emailService.sendInvitationEmails({
      recipients: resolvedGuests.length > 0 ? resolvedGuests : targetEmails,
      invitation,
      event: effectiveEvent,
      senderName: req.user.name || req.user.email,
      frontendUrl,
      snapshotUrl: resolvedSnapshotUrl,
      cardSnapshotUrl: cardSnapshotUrl || snapshotUrl,
      cardImageBase64: (rawSnapshot && rawSnapshot.startsWith && (rawSnapshot.startsWith("data:") || rawSnapshot.length > 300)) ? rawSnapshot : cardImageBase64,
      snapshot: rawSnapshot,
      trackingBaseUrl,
    });

    await invitationService.updateInvitation(invitationId, { ...invitation, status: "published" }, userId);

    return res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${sendResult.recipientCount} guest(s)!`,
      recipientCount: sendResult.recipientCount,
      snapshotUrl: resolvedSnapshotUrl,
    });
  } catch (error) {
    console.error("[InvitationController] Error sending to guests:", error);
    return res.status(500).json({
      error: error.message || "Server error during sending invitation to guests."
    });
  }
};

/**
 * Public endpoint to view invitation and event details without authentication
 * GET /api/invitations/public/:id
 */
const getPublicInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invitationService.findPublicInvitation(id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Invitation or event not found." });
    }

    return res.status(200).json({
      success: true,
      invitation: result.invitation,
      event: result.event,
    });
  } catch (error) {
    console.error("[InvitationController] Error in getPublicInvitation:", error);
    return res.status(500).json({ success: false, error: "Unable to retrieve invitation details." });
  }
};

/**
 * Public endpoint for guests to submit RSVP
 * POST /api/invitations/public/rsvp
 */
const submitPublicRSVP = async (req, res) => {
  try {
    const { eventId, name, email, phone, rsvpStatus } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const guest = await invitationService.submitPublicRSVPData({
      eventId,
      name,
      email,
      phone,
      rsvpStatus,
    });

    return res.status(200).json({
      success: true,
      message: `Thank you, ${guest.name}! Your RSVP has been successfully recorded.`,
      guest,
    });
  } catch (error) {
    console.error("[InvitationController] Error submitting public RSVP:", error);
    return res.status(500).json({ error: "Failed to submit RSVP response. Please try again." });
  }
};

module.exports = {
  getInvitations,
  getInvitationById,
  getInvitationByEvent,
  createInvitation,
  updateInvitation,
  deleteInvitation,
  sendInvitation,
  sendInvitationToGuests,
  getPublicInvitation,
  submitPublicRSVP,
};

