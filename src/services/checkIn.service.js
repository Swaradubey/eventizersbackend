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

  // ── Normalise raw QR payload ─────────────────────────────────────────────────
  // Handles three payload formats:
  //  a) Full URL  : https://domain.com/check-in/{uuid}?token=xyz
  //  b) JSON str  : {"guestId":"...","ticketId":"...",...}
  //  c) Raw string: plain UUID / ticket ID
  console.log("[CheckIn] Scanned Raw QR Data:", qrCode);

  let cleanCode = (qrCode || "").trim();

  // (b) JSON payload
  try {
    const parsed = JSON.parse(cleanCode);
    cleanCode = parsed.guestId || parsed.ticketId || parsed.id || parsed.code || cleanCode;
    cleanCode = String(cleanCode).trim();
  } catch (_) {
    // Not JSON — continue
  }

  // (a) Full URL — extract from path or query params
  if (cleanCode.startsWith("http://") || cleanCode.startsWith("https://") || cleanCode.startsWith("/")) {
    try {
      // Attempt full URL parse first
      const parsedUrl = new URL(
        cleanCode.startsWith("/") ? `https://placeholder.com${cleanCode}` : cleanCode
      );

      // Check query params: ?code=, ?token=, ?ticketId=, ?guestId=
      const qParam =
        parsedUrl.searchParams.get("guestId") ||
        parsedUrl.searchParams.get("ticketId") ||
        parsedUrl.searchParams.get("code") ||
        parsedUrl.searchParams.get("token");

      // Check path: /check-in/{uuid}, /tickets/{uuid}, /verify/{uuid}
      const pathMatch = parsedUrl.pathname.match(
        /\/(?:check-in|tickets|verify|checkin)\/([0-9a-fA-F\-]{36})/i
      );

      if (pathMatch) {
        cleanCode = pathMatch[1];
      } else if (qParam && isValidUuid(qParam)) {
        cleanCode = qParam;
      } else if (qParam) {
        cleanCode = qParam;
      }
    } catch (_) {
      // Fallback: simple regex extraction from path
      const pathMatch = cleanCode.match(/\/(?:check-in|tickets|verify|checkin)\/([0-9a-fA-F\-]{36})/i);
      if (pathMatch) {
        cleanCode = pathMatch[1];
      }
    }
  }

  console.log("[CheckIn] Resolved cleanCode:", cleanCode, "| eventId:", eventId);

  // 1. Try resolving cleanCode as Guest ID (UUID)
  if (isValidUuid(cleanCode)) {
    guest = await prisma.guest.findFirst({
      where: {
        id: cleanCode,
        eventId,
      },
    });

    // If guest exists but belongs to a different event, give a clear error
    if (!guest && isValidUuid(cleanCode)) {
      const guestInOtherEvent = await prisma.guest.findUnique({
        where: { id: cleanCode },
      });
      if (guestInOtherEvent) {
        const error = new Error("This ticket belongs to a different event. Please ensure you have the correct event selected.");
        error.status = 400;
        throw error;
      }
    }
  }

  // 2. Try resolving cleanCode as TicketOrder ID
  if (!guest) {
    const order = await prisma.ticketOrder.findFirst({
      where: {
        id: cleanCode,
        eventId,
      },
    });

    // Also try with the raw qrCode in case cleanCode transformation changed it
    const orderFallback = !order && cleanCode !== qrCode
      ? await prisma.ticketOrder.findFirst({ where: { id: qrCode, eventId } })
      : null;

    const resolvedOrder = order || orderFallback;

    if (resolvedOrder) {
      if (resolvedOrder.status !== "PAID") {
        const error = new Error(`Ticket order is ${resolvedOrder.status.toLowerCase()}. Only paid tickets are valid.`);
        error.status = 400;
        throw error;
      }

      ticketId = resolvedOrder.id;

      // Find or dynamically create guest for this order email
      guest = await prisma.guest.findFirst({
        where: {
          eventId,
          email: resolvedOrder.customerEmail,
        },
      });

      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            eventId,
            name: resolvedOrder.customerName,
            email: resolvedOrder.customerEmail,
            status: "confirmed",
          },
        });
      }
    } else {
      // Check if this ticketOrder ID exists but for a different event
      const orderOtherEvent = await prisma.ticketOrder.findFirst({ where: { id: cleanCode } });
      if (orderOtherEvent) {
        const error = new Error("This ticket belongs to a different event. Please ensure you have the correct event selected.");
        error.status = 400;
        throw error;
      }
    }
  }

  // 3. Try resolving cleanCode as TicketOrderItem ID
  if (!guest) {
    const orderItem = await prisma.ticketOrderItem.findFirst({
      where: {
        id: cleanCode,
        order: {
          eventId,
        },
      },
      include: {
        order: true,
      },
    });

    // Also try with the raw qrCode as fallback
    const orderItemFallback = !orderItem && cleanCode !== qrCode
      ? await prisma.ticketOrderItem.findFirst({
          where: { id: qrCode, order: { eventId } },
          include: { order: true },
        })
      : null;

    const resolvedItem = orderItem || orderItemFallback;

    if (resolvedItem) {
      if (resolvedItem.order.status !== "PAID") {
        const error = new Error(`Ticket order is ${resolvedItem.order.status.toLowerCase()}. Only paid tickets are valid.`);
        error.status = 400;
        throw error;
      }

      ticketId = resolvedItem.id;

      // Find or dynamically create guest for this order email
      guest = await prisma.guest.findFirst({
        where: {
          eventId,
          email: resolvedItem.order.customerEmail,
        },
      });

      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            eventId,
            name: resolvedItem.order.customerName,
            email: resolvedItem.order.customerEmail,
            status: "confirmed",
          },
        });
      }
    } else {
      // Check if this item exists for a different event
      const itemOtherEvent = await prisma.ticketOrderItem.findFirst({ where: { id: cleanCode } });
      if (itemOtherEvent) {
        const error = new Error("This ticket belongs to a different event. Please ensure you have the correct event selected.");
        error.status = 400;
        throw error;
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

    const error = new Error("Invalid ticket or QR code. The scanned code could not be matched to any guest for this event.");
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

/**
 * Public Guest QR Check-In verification and status update
 * @param {string} guestId
 * @param {string} [token]
 * @returns {Promise<Object>}
 */
const verifyAndCheckInGuest = async (guestId, token = "") => {
  // 1. Fetch guest with associated event and existing checkIns
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          eventTime: true,
          venue: true,
          address: true,
        },
      },
      checkIns: {
        orderBy: {
          checkedInAt: "desc",
        },
      },
    },
  });

  if (!guest) {
    const error = new Error("Guest invitation not found. Please verify your check-in pass.");
    error.status = 404;
    throw error;
  }

  // 2. Validate cryptographic token if provided
  const { validateGuestToken } = require("./email.service");
  if (token && typeof token === "string" && token.trim()) {
    const isValid = validateGuestToken(guest.id, guest.eventId, token.trim());
    if (!isValid) {
      const error = new Error("Invalid or expired check-in security token.");
      error.status = 403;
      throw error;
    }
  }

  // 3. Check if guest is already checked in
  const existingCheckIn = (guest.checkIns && guest.checkIns.length > 0) ? guest.checkIns[0] : null;

  if (existingCheckIn || guest.status === "checked_in") {
    const checkInTime = existingCheckIn?.checkedInAt || guest.updatedAt || new Date();
    const timeFormatted = new Date(checkInTime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const dateFormatted = new Date(checkInTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      name: guest.name,
      email: guest.email,
      isCheckedIn: true,
      alreadyCheckedIn: true,
      checkedInAt: checkInTime,
      eventTitle: guest.event?.title || "Special Event",
      eventDate: guest.event?.eventDate,
      eventVenue: guest.event?.venue || guest.event?.address,
      message: `${guest.name} was already checked in at ${timeFormatted} on ${dateFormatted}`,
    };
  }

  // 4. Mark attendance / check-in status
  const newCheckIn = await prisma.checkIn.create({
    data: {
      eventId: guest.eventId,
      guestId: guest.id,
      method: "QR",
      checkedInAt: new Date(),
    },
  });

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      status: "checked_in",
      updatedAt: new Date(),
    },
  });

  return {
    name: guest.name,
    email: guest.email,
    isCheckedIn: true,
    alreadyCheckedIn: false,
    checkedInAt: newCheckIn.checkedInAt,
    eventTitle: guest.event?.title || "Special Event",
    eventDate: guest.event?.eventDate,
    eventVenue: guest.event?.venue || guest.event?.address,
    message: "Successfully Checked In",
  };
};

module.exports = {
  getCheckInSummary,
  getGuestsWithCheckInState,
  checkInGuestManual,
  checkInGuestScan,
  undoCheckIn,
  verifyAndCheckInGuest,
};
