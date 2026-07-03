const prisma = require("../config/prisma");

/**
 * Create and send a new message
 * POST /api/messages
 */
const createMessage = async (req, res) => {
  try {
    const { eventId, recipientType, recipientIds, subject, body } = req.body;
    const senderId = req.user.id; // Int

    // 1. Validation
    if (!eventId || !recipientType || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (trimmedSubject.length === 0 || trimmedBody.length === 0) {
      return res.status(400).json({ error: "Subject and body cannot be empty." });
    }

    // 2. Verify event exists and belongs to the authenticated user
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        createdBy: senderId
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!event) {
      return res.status(403).json({ error: "Access denied. You do not own this event or event does not exist." });
    }

    // 3. Resolve recipients based on recipientType
    let targetGuestIds = [];

    if (recipientType === "ALL_GUESTS") {
      const guests = await prisma.guest.findMany({
        where: { eventId },
        select: { id: true }
      });
      targetGuestIds = guests.map(g => g.id);
    } else if (recipientType === "ATTENDING") {
      const guests = await prisma.guest.findMany({
        where: { eventId, status: "confirmed" },
        select: { id: true }
      });
      targetGuestIds = guests.map(g => g.id);
    } else if (recipientType === "DECLINED") {
      const guests = await prisma.guest.findMany({
        where: { eventId, status: "declined" },
        select: { id: true }
      });
      targetGuestIds = guests.map(g => g.id);
    } else if (recipientType === "PENDING") {
      const guests = await prisma.guest.findMany({
        where: {
          eventId,
          status: { in: ["pending", "invited"] }
        },
        select: { id: true }
      });
      targetGuestIds = guests.map(g => g.id);
    } else if (recipientType === "SELECTED") {
      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: "Recipient IDs list is required for SELECTED recipient type." });
      }
      
      // Remove duplicate IDs
      const uniqueIds = [...new Set(recipientIds)];

      // Validate all IDs belong to this event
      const guests = await prisma.guest.findMany({
        where: {
          id: { in: uniqueIds },
          eventId
        },
        select: { id: true }
      });

      if (guests.length !== uniqueIds.length) {
        return res.status(400).json({ error: "One or more recipient IDs are invalid or do not belong to the event." });
      }

      targetGuestIds = guests.map(g => g.id);
    } else {
      return res.status(400).json({ error: "Invalid recipient type." });
    }

    const uniqueGuestIds = [...new Set(targetGuestIds)];

    if (uniqueGuestIds.length === 0) {
      return res.status(400).json({ error: "No recipients found matching the selection criteria." });
    }

    // 4. Create Message and MessageRecipient records in one atomic nested create write
    const createdMessage = await prisma.message.create({
      data: {
        subject: trimmedSubject,
        body: trimmedBody,
        status: "SENT",
        recipientType,
        senderId,
        eventId,
        sentAt: new Date(),
        recipients: {
          createMany: {
            data: uniqueGuestIds.map(guestId => ({
              guestId
            })),
            skipDuplicates: true
          }
        }
      },
      include: {
        event: {
          select: { title: true }
        },
        _count: {
          select: { recipients: true }
        }
      }
    });

    const formattedMessage = {
      id: createdMessage.id,
      subject: createdMessage.subject,
      body: createdMessage.body,
      status: createdMessage.status,
      recipientType: createdMessage.recipientType,
      eventId: createdMessage.eventId,
      eventTitle: createdMessage.event?.title || "General",
      recipientCount: createdMessage._count.recipients,
      sentAt: createdMessage.sentAt,
      createdAt: createdMessage.createdAt,
      updatedAt: createdMessage.updatedAt
    };

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: formattedMessage
    });

  } catch (error) {
    console.error("Create Message Error:", error);

    // Specific Prisma error handler mapping
    if (error?.code === "P2028") {
      return res.status(503).json({ error: "Message creation timed out. Please try again." });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "A message with these details already exists." });
    }
    if (error?.code === "P2003") {
      return res.status(400).json({ error: "Invalid event or sender references." });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Required record not found." });
    }
    if (error?.code === "P1001" || error?.code === "P1002") {
      return res.status(503).json({ error: "Database connectivity issues. Please try again later." });
    }

    return res.status(500).json({ error: "Server error during message creation." });
  }
};

/**
 * Return only messages created by the currently logged-in user
 * GET /api/messages
 */
const getMessages = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { search } = req.query;

    let whereClause = { senderId };

    if (search) {
      whereClause.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
        { event: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        event: {
          select: { title: true }
        },
        _count: {
          select: { recipients: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedMessages = messages.map(m => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      status: m.status,
      recipientType: m.recipientType,
      eventId: m.eventId,
      eventTitle: m.event?.title || "General",
      recipientCount: m._count.recipients,
      sentAt: m.sentAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    }));

    return res.status(200).json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error("Get Messages Error:", error);
    return res.status(500).json({ error: "Server error retrieving messages." });
  }
};

/**
 * Return one message belonging to the logged-in user
 * GET /api/messages/:id
 */
const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const senderId = req.user.id;

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        event: {
          select: { title: true }
        },
        recipients: {
          include: {
            guest: {
              select: { name: true, email: true, phone: true, status: true }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    if (message.senderId !== senderId) {
      return res.status(403).json({ error: "Access denied. You do not own this message." });
    }

    const formattedMessage = {
      id: message.id,
      subject: message.subject,
      body: message.body,
      status: message.status,
      recipientType: message.recipientType,
      eventId: message.eventId,
      eventTitle: message.event?.title || "General",
      sentAt: message.sentAt,
      createdAt: message.createdAt,
      recipients: message.recipients.map(r => ({
        id: r.id,
        guestId: r.guestId,
        name: r.guest?.name || "Unknown",
        email: r.guest?.email || "",
        phone: r.guest?.phone || "",
        status: r.guest?.status || ""
      }))
    };

    return res.status(200).json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    console.error("Get Message By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving message details." });
  }
};

/**
 * Delete only the logged-in user's own message
 * DELETE /api/messages/:id
 */
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const senderId = req.user.id;

    const message = await prisma.message.findUnique({
      where: { id }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    if (message.senderId !== senderId) {
      return res.status(403).json({ error: "Access denied. You do not own this message." });
    }

    await prisma.message.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully."
    });
  } catch (error) {
    console.error("Delete Message Error:", error);
    return res.status(500).json({ error: "Server error deleting message." });
  }
};

/**
 * Return real statistics for the logged-in user
 * GET /api/messages/stats
 */
const getStats = async (req, res) => {
  try {
    const senderId = req.user.id;

    const [totalMessages, sentMessages, totalRecipients] = await Promise.all([
      prisma.message.count({
        where: { senderId }
      }),
      prisma.message.count({
        where: { senderId, status: "SENT" }
      }),
      prisma.messageRecipient.count({
        where: {
          message: { senderId }
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalMessages,
        sentMessages,
        totalRecipients
      }
    });
  } catch (error) {
    console.error("Get User Message Stats Error:", error);
    return res.status(500).json({ error: "Server error retrieving message statistics." });
  }
};

/**
 * Admin: Return messages from all users
 * GET /api/admin/messages
 */
const adminGetMessages = async (req, res) => {
  try {
    const { search, status, recipientType } = req.query;

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (recipientType) {
      whereClause.recipientType = recipientType;
    }

    if (search) {
      const searchStr = search.trim();
      whereClause.OR = [
        { subject: { contains: searchStr, mode: "insensitive" } },
        { sender: { name: { contains: searchStr, mode: "insensitive" } } },
        { sender: { email: { contains: searchStr, mode: "insensitive" } } },
        { event: { title: { contains: searchStr, mode: "insensitive" } } }
      ];
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { name: true, email: true }
        },
        event: {
          select: { title: true }
        },
        _count: {
          select: { recipients: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedMessages = messages.map(m => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      status: m.status,
      recipientType: m.recipientType,
      sentAt: m.sentAt,
      createdAt: m.createdAt,
      senderName: m.sender?.name || "Unknown",
      senderEmail: m.sender?.email || "",
      eventTitle: m.event?.title || "General",
      recipientCount: m._count.recipients
    }));

    return res.status(200).json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error("Admin Get Messages Error:", error);
    return res.status(500).json({ error: "Server error retrieving messages for admin." });
  }
};

/**
 * Admin: Return one message with recipients detail
 * GET /api/admin/messages/:id
 */
const adminGetMessageById = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: { name: true, email: true }
        },
        event: {
          select: { title: true }
        },
        recipients: {
          include: {
            guest: {
              select: { name: true, email: true, phone: true, status: true }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    const formattedMessage = {
      id: message.id,
      subject: message.subject,
      body: message.body,
      status: message.status,
      recipientType: message.recipientType,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
      senderName: message.sender?.name || "Unknown",
      senderEmail: message.sender?.email || "",
      eventTitle: message.event?.title || "General",
      recipients: message.recipients.map(r => ({
        id: r.id,
        guestId: r.guestId,
        name: r.guest?.name || "Unknown",
        email: r.guest?.email || "",
        phone: r.guest?.phone || "",
        status: r.guest?.status || ""
      }))
    };

    return res.status(200).json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    console.error("Admin Get Message By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving message details for admin." });
  }
};

/**
 * Admin: Return global message statistics
 * GET /api/admin/messages/stats
 */
const adminGetStats = async (req, res) => {
  try {
    const [totalMessages, sentMessages, totalRecipients] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({
        where: { status: "SENT" }
      }),
      prisma.messageRecipient.count()
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalMessages,
        sentMessages,
        totalRecipients
      }
    });
  } catch (error) {
    console.error("Admin Get Stats Error:", error);
    return res.status(500).json({ error: "Server error retrieving global message statistics." });
  }
};

module.exports = {
  createMessage,
  getMessages,
  getMessageById,
  deleteMessage,
  getStats,
  adminGetMessages,
  adminGetMessageById,
  adminGetStats
};
