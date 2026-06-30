const invitationService = require("../services/invitation.service");
const eventService = require("../services/event.service");

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

/**
 * Send invitation placeholder
 * POST /api/invitations/:id/send
 */
const sendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const invitation = await invitationService.findInvitationById(id, userId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    // Set state to published when sending
    await invitationService.updateInvitation(id, { ...invitation, status: "published" }, userId);

    return res.status(200).json({
      success: true,
      message: "Invitation queued."
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error during sending invitation.");
  }
};

/**
 * Send invitation to specific guests (modular for future email integration)
 * POST /api/invitations/send
 */
const sendInvitationToGuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { invitationId, guestIds } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: "invitationId is required." });
    }

    const invitation = await invitationService.findInvitationById(invitationId, userId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or unauthorized access." });
    }

    // Mark invitation as published
    await invitationService.updateInvitation(invitationId, { ...invitation, status: "published" }, userId);

    // Log the send action for future email integration
    const targetGuestCount = Array.isArray(guestIds) ? guestIds.length : 0;
    console.log(`[InvitationSend] Invitation "${invitation.title}" (${invitationId}) queued for ${targetGuestCount > 0 ? targetGuestCount + " guests" : "all guests"}.`);

    return res.status(200).json({
      success: true,
      message: `Invitation sent successfully${targetGuestCount > 0 ? " to " + targetGuestCount + " guests" : ""}.`,
    });
  } catch (error) {
    return handlePrismaError(error, res, "Server error during sending invitation to guests.");
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
};
