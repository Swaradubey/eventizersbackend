const invitationService = require("../services/invitation.service");
const eventService = require("../services/event.service");
const guestService = require("../services/guest.service");
const emailService = require("../services/email.service");

// Helper to validate hex colors
const isValidHexColor = (color) => {
  if (!color) return false;
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(color);
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
      status
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

    // Validate Title Size (20 - 80)
    if (titleSize !== undefined && (titleSize < 20 || titleSize > 80)) {
      return res.status(400).json({ error: "Title size must be between 20 and 80." });
    }

    // Validate Colors
    if (accentColor && !isValidHexColor(accentColor)) {
      return res.status(400).json({ error: "Invalid Accent Color HEX format." });
    }
    if (backgroundColor && !isValidHexColor(backgroundColor)) {
      return res.status(400).json({ error: "Invalid Background Color HEX format." });
    }
    if (textColor && !isValidHexColor(textColor)) {
      return res.status(400).json({ error: "Invalid Text Color HEX format." });
    }
    if (buttonColor && !isValidHexColor(buttonColor)) {
      return res.status(400).json({ error: "Invalid Button Color HEX format." });
    }

    const payloadId = id || `inv_${Math.random().toString(36).substr(2, 9)}`;

    // Verify if invitation already exists for this event
    const existing = await invitationService.findInvitationByEventId(eventId, userId);
    if (existing) {
      return res.status(400).json({ error: "An invitation already exists for this event." });
    }

    const newInvitation = await invitationService.createInvitation(
      {
        id: payloadId,
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
        status: status || "draft"
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
      status
    } = req.body;

    // Verify user owns the invitation
    const existingInvitation = await invitationService.findInvitationById(id, userId);
    if (!existingInvitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    // Validate required fields
    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Title is required." });
    }

    // Validate Title Size (20 - 80)
    if (titleSize !== undefined && (titleSize < 20 || titleSize > 80)) {
      return res.status(400).json({ error: "Title size must be between 20 and 80." });
    }

    // Validate Colors
    if (accentColor && !isValidHexColor(accentColor)) {
      return res.status(400).json({ error: "Invalid Accent Color HEX format." });
    }
    if (backgroundColor && !isValidHexColor(backgroundColor)) {
      return res.status(400).json({ error: "Invalid Background Color HEX format." });
    }
    if (textColor && !isValidHexColor(textColor)) {
      return res.status(400).json({ error: "Invalid Text Color HEX format." });
    }
    if (buttonColor && !isValidHexColor(buttonColor)) {
      return res.status(400).json({ error: "Invalid Button Color HEX format." });
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
        imageUrl: imageUrl !== undefined ? imageUrl : existingInvitation.imageUrl,
        buttonText: buttonText || existingInvitation.buttonText,
        buttonColor: buttonColor || existingInvitation.buttonColor,
        buttonRadius: buttonRadius !== undefined ? buttonRadius : existingInvitation.buttonRadius,
        status: status || existingInvitation.status
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
  return [];
};

/**
 * Send invitation via email
 * POST /api/invitations/:id/send
 */
const sendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { recipients, guestEmails } = req.body || {};

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

    // Determine target recipient emails
    let targetEmails = [];

    // 1. Direct recipient array or string (e.g. swaraswn@gmail.com) from request body
    if (recipients) {
      targetEmails = parseRecipientEmails(recipients);
    }
    if (targetEmails.length === 0 && guestEmails) {
      targetEmails = parseRecipientEmails(guestEmails);
    }

    // 2. Fallback to event guest list if no explicit recipients supplied
    if (targetEmails.length === 0 && invitation.eventId) {
      try {
        const guests = await guestService.findGuestsByUserId(userId, "", invitation.eventId);
        if (Array.isArray(guests)) {
          targetEmails = guests.map(g => g.email ? g.email.trim().toLowerCase() : "").filter(e => e && e.includes("@"));
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

    // Send emails via Nodemailer or Resend service
    const sendResult = await emailService.sendInvitationEmails({
      recipients: targetEmails,
      invitation,
      event,
      senderName: req.user.name || req.user.email,
    });

    // Mark status as published
    await invitationService.updateInvitation(id, { ...invitation, status: "published" }, userId);

    return res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${sendResult.recipientCount} recipient(s)!`,
      recipientCount: sendResult.recipientCount,
      previewUrl: sendResult.previewUrl || null,
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
    const { invitationId, guestIds, recipients } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: "invitationId is required." });
    }

    const invitation = await invitationService.findInvitationById(invitationId, userId);
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

    const sendResult = await emailService.sendInvitationEmails({
      recipients: targetEmails,
      invitation,
      event,
      senderName: req.user.name || req.user.email,
    });

    await invitationService.updateInvitation(invitationId, { ...invitation, status: "published" }, userId);

    return res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${sendResult.recipientCount} guest(s)!`,
      recipientCount: sendResult.recipientCount,
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

