const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");
const { createAuditLog, createSecurityAlert } = require("../utils/auditLogger");

/**
 * Helper to verify that a user owns the event
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const verifyEventOwnership = async (eventId, userId) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      createdBy: parseInt(userId, 10),
    },
  });
  return !!event;
};

/**
 * Get check-in summary statistics
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const getCheckInSummary = async (eventId, userId) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    throw new Error("Unauthorized event access.");
  }

  const total = await prisma.guest.count({
    where: { eventId },
  });

  const checkedIn = await prisma.checkIn.count({
    where: { eventId },
  });

  const pending = Math.max(0, total - checkedIn);

  return {
    checkedIn,
    pending,
    total,
  };
};

/**
 * Get paginated list of guests with check-in state
 * @param {string} eventId
 * @param {number} userId
 * @param {Object} queryOptions
 * @returns {Promise<Object>}
 */
const getGuestsWithCheckInState = async (eventId, userId, queryOptions = {}) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    throw new Error("Unauthorized event access.");
  }

  const { search = "", status = "all", page = 1, limit = 50 } = queryOptions;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const whereClause = {
    eventId,
  };

  // Add search filters
  if (search.trim()) {
    const searchTerm = search.trim();
    
    // Check if search matches a TicketOrder ID, payment reference, or TicketOrderItem ID
    const matchingOrders = await prisma.ticketOrder.findMany({
      where: {
        eventId,
        OR: [
          { id: searchTerm },
          { paymentReference: searchTerm },
          { items: { some: { id: searchTerm } } },
        ],
      },
      select: {
        customerEmail: true,
      },
    });

    const orderEmails = matchingOrders.map((o) => o.customerEmail);

    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
      ...(orderEmails.length > 0 ? [{ email: { in: orderEmails } }] : []),
    ];
  }

  // Add check-in status filters
  if (status === "checked_in") {
    whereClause.checkIns = { some: {} };
  } else if (status === "pending") {
    whereClause.checkIns = { none: {} };
  }

  // Fetch count for pagination
  const totalGuests = await prisma.guest.count({
    where: whereClause,
  });

  // Fetch guests
  const guests = await prisma.guest.findMany({
    where: whereClause,
    include: {
      checkIns: true,
    },
    orderBy: {
      name: "asc",
    },
    skip,
    take,
  });

  // Map guests to output structure with ticket tiers
  const guestsWithState = await Promise.all(
    guests.map(async (guest) => {
      // Look up paid ticket order to find tier name
      const order = await prisma.ticketOrder.findFirst({
        where: {
          eventId: guest.eventId,
          customerEmail: guest.email,
          status: "PAID",
        },
        include: {
          items: {
            include: {
              ticketTier: true,
            },
          },
        },
      });

      const ticketTierName = order?.items[0]?.ticketTier?.name || "General";
      const checkIn = guest.checkIns[0] || null;

      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        ticketTier: ticketTierName,
        status: checkIn ? "CHECKED_IN" : "PENDING",
        checkedInAt: checkIn ? checkIn.checkedInAt : null,
        method: checkIn ? checkIn.method : null,
        gpsVerified: checkIn ? (checkIn.latitude !== null && checkIn.longitude !== null) : false,
        checkInId: checkIn ? checkIn.id : null,
      };
    })
  );

  const totalPages = Math.ceil(totalGuests / take) || 1;

  return {
    guests: guestsWithState,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total: totalGuests,
      totalPages,
    },
  };
};

/**
 * Manual check-in
 * @param {string} eventId
 * @param {string} guestId
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const checkInGuestManual = async (eventId, guestId, latitude, longitude, userId) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    const error = new Error("Unauthorized event access.");
    error.status = 403;
    throw error;
  }

  // Find guest
  const guest = await prisma.guest.findFirst({
    where: {
      id: guestId,
      eventId,
    },
  });

  if (!guest) {
    const error = new Error("Guest not found for this event.");
    error.status = 404;
    throw error;
  }

  // Check if already checked in
  const existingCheckIn = await prisma.checkIn.findUnique({
    where: {
      eventId_guestId: {
        eventId,
        guestId,
      },
    },
  });

  if (existingCheckIn) {
    const error = new Error("Guest is already checked in.");
    error.status = 409;
    throw error;
  }

  // Create check-in
  const checkIn = await prisma.checkIn.create({
    data: {
      eventId,
      guestId,
      method: "MANUAL",
      latitude: latitude ? new Prisma.Decimal(latitude) : null,
      longitude: longitude ? new Prisma.Decimal(longitude) : null,
      checkedInById: String(userId),
    },
  });

  return {
    ...checkIn,
    latitude: checkIn.latitude ? Number(checkIn.latitude) : null,
    longitude: checkIn.longitude ? Number(checkIn.longitude) : null,
  };
};

/**
 * Verify if string is valid UUID
 * @param {string} str
 * @returns {boolean}
 */
const isValidUuid = (str) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/**
 * QR scan check-in
 * @param {string} eventId
 * @param {string} qrCode
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const checkInGuestScan = async (eventId, qrCode, latitude, longitude, userId) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    const error = new Error("Unauthorized event access.");
    error.status = 403;
    throw error;
  }

  let guest = null;
  let ticketId = null;

  // 1. Try resolving qrCode as Guest ID (UUID)
  if (isValidUuid(qrCode)) {
    guest = await prisma.guest.findFirst({
      where: {
        id: qrCode,
        eventId,
      },
    });
  }

  // 2. Try resolving as TicketOrder ID
  if (!guest) {
    const order = await prisma.ticketOrder.findFirst({
      where: {
        id: qrCode,
        eventId,
      },
    });

    if (order) {
      if (order.status !== "PAID") {
        const error = new Error(`Ticket order is ${order.status.toLowerCase()}. Only paid tickets are valid.`);
        error.status = 400;
        throw error;
      }

      ticketId = order.id;

      // Find or dynamically create guest for this order email
      guest = await prisma.guest.findFirst({
        where: {
          eventId,
          email: order.customerEmail,
        },
      });

      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            eventId,
            name: order.customerName,
            email: order.customerEmail,
            status: "confirmed",
          },
        });
      }
    }
  }

  // 3. Try resolving as TicketOrderItem ID
  if (!guest) {
    const orderItem = await prisma.ticketOrderItem.findFirst({
      where: {
        id: qrCode,
        order: {
          eventId,
        },
      },
      include: {
        order: true,
      },
    });

    if (orderItem) {
      if (orderItem.order.status !== "PAID") {
        const error = new Error(`Ticket order is ${orderItem.order.status.toLowerCase()}. Only paid tickets are valid.`);
        error.status = 400;
        throw error;
      }

      ticketId = orderItem.id;

      // Find or dynamically create guest for this order email
      guest = await prisma.guest.findFirst({
        where: {
          eventId,
          email: orderItem.order.customerEmail,
        },
      });

      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            eventId,
            name: orderItem.order.customerName,
            email: orderItem.order.customerEmail,
            status: "confirmed",
          },
        });
      }
    }
  }

  // If still not resolved
  if (!guest) {
    await createSecurityAlert({
      type: "VERIFICATION_FAILED",
      description: `Failed verification: Invalid QR code or ticket '${qrCode?.substring(0, 50)}' scanned.`,
      severity: "MEDIUM",
      eventId
    });
    await createAuditLog({
      userId,
      action: "VERIFICATION_FAILED",
      eventId
    });

    const error = new Error("Invalid ticket or QR code.");
    error.status = 404;
    throw error;
  }

  // Check if check-in already exists for guest or ticket
  const existingCheckIn = await prisma.checkIn.findFirst({
    where: {
      eventId,
      OR: [
        { guestId: guest.id },
        ...(ticketId ? [{ ticketId }] : []),
      ],
    },
  });

  if (existingCheckIn) {
    await createSecurityAlert({
      type: "DUPLICATE_TICKET",
      description: `Duplicate Scan Detected: Ticket for ${guest.name} (${guest.email}) was scanned more than once.`,
      severity: "HIGH",
      eventId
    });
    await createAuditLog({
      userId,
      action: "DUPLICATE_TICKET_DETECTED",
      eventId
    });

    const error = new Error("Guest is already checked in.");
    error.status = 409;
    throw error;
  }

  // Create check-in
  const checkIn = await prisma.checkIn.create({
    data: {
      eventId,
      guestId: guest.id,
      ticketId,
      method: "QR",
      latitude: latitude ? new Prisma.Decimal(latitude) : null,
      longitude: longitude ? new Prisma.Decimal(longitude) : null,
      checkedInById: String(userId),
    },
  });

  // Log successful scan in AuditLog
  await createAuditLog({
    userId,
    action: "TICKET_SCANNED",
    eventId
  });

  // Get ticket tier
  const order = await prisma.ticketOrder.findFirst({
    where: {
      eventId,
      customerEmail: guest.email,
      status: "PAID",
    },
    include: {
      items: {
        include: {
          ticketTier: true,
        },
      },
    },
  });

  const ticketTierName = order?.items[0]?.ticketTier?.name || "General";

  return {
    guest: {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      ticketTier: ticketTierName,
      status: "CHECKED_IN",
      checkedInAt: checkIn.checkedInAt,
      method: "QR",
      gpsVerified: checkIn.latitude !== null && checkIn.longitude !== null,
    },
    checkIn: {
      ...checkIn,
      latitude: checkIn.latitude ? Number(checkIn.latitude) : null,
      longitude: checkIn.longitude ? Number(checkIn.longitude) : null,
    },
  };
};

/**
 * Undo check-in
 * @param {string} checkInId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const undoCheckIn = async (checkInId, userId) => {
  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
  });

  if (!checkIn) {
    const error = new Error("Check-in record not found.");
    error.status = 404;
    throw error;
  }

  const isOwner = await verifyEventOwnership(checkIn.eventId, userId);
  if (!isOwner) {
    const error = new Error("Unauthorized event access.");
    error.status = 403;
    throw error;
  }

  await prisma.checkIn.delete({
    where: { id: checkInId },
  });

  return true;
};

module.exports = {
  getCheckInSummary,
  getGuestsWithCheckInState,
  checkInGuestManual,
  checkInGuestScan,
  undoCheckIn,
};
