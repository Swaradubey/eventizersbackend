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

module.exports = {
  findInvitationsByUserId,
  findInvitationById,
  findInvitationByEventId,
  createInvitation,
  updateInvitation,
  deleteInvitation,
};
