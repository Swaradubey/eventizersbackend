const prisma = require("../config/prisma");

/**
 * Find all invitations for events created by a specific user
 * @param {number} userId
 * @returns {Promise<Array>}
 */
const findInvitationsByUserId = async (userId) => {
  const invitations = await prisma.invitation.findMany({
    where: {
      event: {
        createdBy: userId,
      },
    },
    include: {
      event: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return invitations.map((inv) => ({
    ...inv,
    eventTitle: inv.event?.title || null,
    event: undefined,
  }));
};

/**
 * Find a specific invitation by ID and user ID
 * @param {string} id
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const findInvitationById = async (id, userId) => {
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      event: {
        createdBy: userId,
      },
    },
    include: {
      event: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!invitation) return null;

  return {
    ...invitation,
    eventTitle: invitation.event?.title || null,
    event: undefined,
  };
};

/**
 * Find invitation by event ID and user ID
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const findInvitationByEventId = async (eventId, userId) => {
  const invitation = await prisma.invitation.findFirst({
    where: {
      eventId,
      event: {
        createdBy: userId,
      },
    },
    include: {
      event: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!invitation) return null;

  return {
    ...invitation,
    eventTitle: invitation.event?.title || null,
    event: undefined,
  };
};

/**
 * Create a new invitation
 * @param {Object} data
 * @param {number} userId - used for ownership verification (already done in controller)
 * @returns {Promise<Object>}
 */
const createInvitation = async (data, userId) => {
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
  } = data;

  const invitation = await prisma.invitation.create({
    data: {
      id: id || undefined,
      eventId,
      title,
      subtitle: subtitle || null,
      mainText: mainText || null,
      message: message || null,
      accentColor: accentColor || "#5B5FEF",
      backgroundColor: backgroundColor || "#F6F9FC",
      textColor: textColor || "#1A1118",
      titleSize: titleSize || 48,
      fontWeight: fontWeight || "normal",
      fontFamily: fontFamily || "sans-serif",
      textAlignment: textAlignment || "center",
      imageUrl: imageUrl || null,
      buttonText: buttonText || "RSVP Now",
      buttonColor: buttonColor || "#5B5FEF",
      buttonRadius: buttonRadius !== undefined ? buttonRadius : 8,
      status: status || "draft",
    },
  });

  return invitation;
};

/**
 * Update an existing invitation
 * @param {string} id
 * @param {Object} data
 * @param {number} userId - used for ownership verification (already done in controller)
 * @returns {Promise<Object|null>}
 */
const updateInvitation = async (id, data, userId) => {
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
  } = data;

  try {
    const invitation = await prisma.invitation.update({
      where: { id },
      data: {
        title,
        subtitle: subtitle !== undefined ? subtitle : undefined,
        mainText: mainText !== undefined ? mainText : undefined,
        message: message !== undefined ? message : undefined,
        accentColor,
        backgroundColor,
        textColor,
        titleSize,
        fontWeight,
        fontFamily,
        textAlignment,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        buttonText,
        buttonColor,
        buttonRadius,
        status,
      },
    });

    return invitation;
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }
};

/**
 * Delete an invitation
 * @param {string} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const deleteInvitation = async (id, userId) => {
  // First verify ownership
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      event: {
        createdBy: userId,
      },
    },
  });

  if (!invitation) return false;

  await prisma.invitation.delete({
    where: { id },
  });

  return true;
};

/**
 * Find public invitation and associated event details by invitation ID or Event ID
 * @param {string} idOrEventId
 * @returns {Promise<Object|null>}
 */
const findPublicInvitation = async (idOrEventId) => {
  if (!idOrEventId) return null;

  // 1. Find by Invitation ID
  let invitation = await prisma.invitation.findUnique({
    where: { id: idOrEventId },
    include: {
      event: true,
    },
  });

  // 2. Find by Event ID if not found by Invitation ID
  if (!invitation) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEventId);
    if (isUuid) {
      invitation = await prisma.invitation.findFirst({
        where: { eventId: idOrEventId },
        include: {
          event: true,
        },
      });
    }
  }

  // 3. If invitation record not created yet, check if event exists
  if (!invitation) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEventId);
    if (!isUuid) return null;

    const event = await prisma.event.findUnique({
      where: { id: idOrEventId },
    });

    if (!event) return null;

    return {
      invitation: {
        id: `default_${event.id}`,
        eventId: event.id,
        title: event.title,
        subtitle: event.eventType || "You're Invited!",
        mainText: event.description || "Join us for a memorable celebration.",
        message: null,
        accentColor: "#5B5FEF",
        backgroundColor: "#F6F9FC",
        textColor: "#1A1118",
        titleSize: 48,
        fontWeight: "normal",
        fontFamily: "sans-serif",
        textAlignment: "center",
        imageUrl: event.coverImage || null,
        buttonText: "RSVP Now",
        buttonColor: "#5B5FEF",
        buttonRadius: 8,
        status: "published",
      },
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        venue: event.venue,
        address: event.address,
        city: event.city,
        state: event.state,
        country: event.country,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        coverImage: event.coverImage,
      },
    };
  }

  const eventData = invitation.event;
  const invData = {
    ...invitation,
    event: undefined,
  };

  return {
    invitation: invData,
    event: eventData,
  };
};

/**
 * Submit public guest RSVP response
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const submitPublicRSVPData = async ({ eventId, name, email, phone, rsvpStatus }) => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanPhone = phone ? phone.trim() : null;
  const statusVal = (rsvpStatus || "confirmed").toLowerCase();
  const finalStatus = (statusVal === "attending" || statusVal === "yes" || statusVal === "confirmed")
    ? "confirmed"
    : (statusVal === "declined" || statusVal === "no" ? "declined" : "pending");

  const existingGuest = await prisma.guest.findFirst({
    where: {
      eventId,
      email: cleanEmail,
    },
  });

  let guest;
  if (existingGuest) {
    guest = await prisma.guest.update({
      where: { id: existingGuest.id },
      data: {
        name: cleanName,
        phone: cleanPhone || existingGuest.phone,
        status: finalStatus,
        rsvpStatus: finalStatus,
        respondedAt: new Date(),
      },
    });
  } else {
    guest = await prisma.guest.create({
      data: {
        eventId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        status: finalStatus,
        rsvpStatus: finalStatus,
        respondedAt: new Date(),
      },
    });
  }

  return guest;
};

module.exports = {
  findInvitationsByUserId,
  findInvitationById,
  findInvitationByEventId,
  createInvitation,
  updateInvitation,
  deleteInvitation,
  findPublicInvitation,
  submitPublicRSVPData,
};

