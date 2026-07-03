const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const eventService = require("../services/event.service");

// Helper function to generate token and set cookie (matches auth.controller.js)
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  const { password_hash, password, ...userWithoutPassword } = user;

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      message: "Admin login successful",
      user: userWithoutPassword,
      token,
    });
};

/**
 * Admin Login
 * POST /api/admin/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Access Denied. Normal users cannot access the admin panel." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({ error: "Server error during admin login." });
  }
};

/**
 * Admin Logout
 * POST /api/admin/logout
 */
const logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully.",
    });
  } catch (error) {
    console.error("Admin Logout Error:", error);
    return res.status(500).json({ error: "Server error during admin logout." });
  }
};

/**
 * Admin Profile
 * GET /api/admin/me
 */
const me = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Admin Me Error:", error);
    return res.status(500).json({ error: "Server error retrieving admin profile." });
  }
};

/**
 * Get aggregated admin dashboard statistics
 * GET /api/admin/dashboard/stats
 */
const getStats = async (req, res) => {
  try {
    const [
      totalEvents,
      totalGuests,
      confirmedGuests,
      messagesSent,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.guest.count(),
      prisma.guest.count({
        where: { status: "confirmed" },
      }),
      prisma.invitation.count({
        where: { status: "published" },
      }),
    ]);

    const averageRsvpRate =
      totalGuests === 0
        ? 0
        : Number(((confirmedGuests / totalGuests) * 100).toFixed(1));

    return res.status(200).json({
      success: true,
      stats: {
        totalEvents,
        totalGuests,
        averageRsvpRate,
        messagesSent,
      },
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);
    return res.status(500).json({ error: "Server error retrieving admin dashboard statistics." });
  }
};

/**
 * Get all events across all users
 * GET /api/admin/events
 */
const getEvents = async (req, res) => {
  try {
    const rawEvents = await prisma.event.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Normalize date/time representations for frontend compatibility
    const events = rawEvents.map((event) => {
      let eventDateStr = event.eventDate;
      if (event.eventDate instanceof Date) {
        eventDateStr = event.eventDate.toISOString().split("T")[0];
      }

      let eventTimeStr = event.eventTime;
      if (event.eventTime instanceof Date) {
        eventTimeStr = event.eventTime.toISOString().split("T")[1].slice(0, 8);
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        venue: event.venue,
        address: event.address,
        city: event.city,
        state: event.state,
        country: event.country,
        eventDate: eventDateStr,
        eventTime: eventTimeStr,
        coverImage: event.coverImage,
        status: event.status,
        createdBy: event.createdBy,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        user: event.user,
      };
    });

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Admin Get Events Error:", error);
    return res.status(500).json({ error: "Server error retrieving admin events." });
  }
};

/**
 * Get a specific event by ID (admin bypass)
 * GET /api/admin/events/:id
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    let eventDateStr = event.eventDate;
    if (event.eventDate instanceof Date) {
      eventDateStr = event.eventDate.toISOString().split("T")[0];
    }

    let eventTimeStr = event.eventTime;
    if (event.eventTime instanceof Date) {
      eventTimeStr = event.eventTime.toISOString().split("T")[1].slice(0, 8);
    }

    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      venue: event.venue,
      address: event.address,
      city: event.city,
      state: event.state,
      country: event.country,
      eventDate: eventDateStr,
      eventTime: eventTimeStr,
      coverImage: event.coverImage,
      status: event.status,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      user: event.user,
    };

    return res.status(200).json({
      success: true,
      event: formattedEvent,
    });
  } catch (error) {
    console.error("Admin Get Event By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving event details." });
  }
};

/**
 * Create a new event under the admin account
 * POST /api/admin/events
 */
const createEvent = async (req, res) => {
  try {
    const { title, eventDate, eventTime, venue } = req.body;

    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({ 
        error: "Missing required fields. Please provide title, date, time, and venue." 
      });
    }

    const newEvent = await eventService.createEvent(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      message: "Event created successfully by Admin",
      event: newEvent,
    });
  } catch (error) {
    console.error("Admin Create Event Error:", error);
    return res.status(500).json({ error: error.message || "Server error during event creation." });
  }
};

/**
 * Update any event by ID
 * PUT /api/admin/events/:id
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, eventDate, eventTime, venue, description, eventType, address, city, state, country, coverImage, status } = req.body;

    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({ 
        error: "Missing required fields. Please provide title, date, time, and venue." 
      });
    }

    const parsedEventDate = new Date(eventDate);

    let parsedEventTime;
    if (eventTime instanceof Date) {
      parsedEventTime = eventTime;
    } else {
      const timeStr = eventTime.includes(":") && eventTime.split(":").length === 2 ? `${eventTime}:00` : eventTime;
      parsedEventTime = new Date(`1970-01-01T${timeStr}Z`);
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title,
        description: description || null,
        eventType: eventType || null,
        venue,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        eventDate: parsedEventDate,
        eventTime: parsedEventTime,
        coverImage: coverImage || null,
        status: status || "draft",
      },
    });

    let eventDateStr = updatedEvent.eventDate;
    if (updatedEvent.eventDate instanceof Date) {
      eventDateStr = updatedEvent.eventDate.toISOString().split("T")[0];
    }

    let eventTimeStr = updatedEvent.eventTime;
    if (updatedEvent.eventTime instanceof Date) {
      eventTimeStr = updatedEvent.eventTime.toISOString().split("T")[1].slice(0, 8);
    }

    const formattedEvent = {
      id: updatedEvent.id,
      title: updatedEvent.title,
      description: updatedEvent.description,
      eventType: updatedEvent.eventType,
      venue: updatedEvent.venue,
      address: updatedEvent.address,
      city: updatedEvent.city,
      state: updatedEvent.state,
      country: updatedEvent.country,
      eventDate: eventDateStr,
      eventTime: eventTimeStr,
      coverImage: updatedEvent.coverImage,
      status: updatedEvent.status,
      createdBy: updatedEvent.createdBy,
      createdAt: updatedEvent.createdAt,
      updatedAt: updatedEvent.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Event updated successfully by Admin.",
      event: formattedEvent,
    });
  } catch (error) {
    console.error("Admin Update Event Error:", error);
    return res.status(500).json({ error: "Server error during event update by Admin." });
  }
};

/**
 * Delete any event by ID
 * DELETE /api/admin/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.event.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully by Admin."
    });
  } catch (error) {
    console.error("Admin Delete Event Error:", error);
    return res.status(500).json({ error: "Server error during event deletion by Admin." });
  }
};

/**
 * Get guests for any event (admin bypass)
 * GET /api/admin/events/:eventId/guests
 */
const getEventGuests = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    const guests = await prisma.guest.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      guests,
    });
  } catch (error) {
    console.error("Admin Get Event Guests Error:", error);
    return res.status(500).json({ error: "Server error retrieving event guests." });
  }
};

/**
 * Admin Guests management
 */
const getGuests = async (req, res) => {
  try {
    const rawGuests = await prisma.guest.findMany({
      include: {
        event: {
          select: {
            title: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        checkIns: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const guests = rawGuests.map((g) => {
      const checkIn = g.checkIns[0] || null;
      return {
        id: g.id,
        eventId: g.eventId,
        name: g.name,
        email: g.email,
        phone: g.phone,
        status: g.status,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        eventTitle: g.event?.title || "General",
        eventCreator: g.event?.user || null,
        isCheckedIn: g.checkIns.length > 0,
        checkIn: checkIn
          ? {
              id: checkIn.id,
              checkedInAt: checkIn.checkedInAt,
              method: checkIn.method,
            }
          : null,
      };
    });

    return res.status(200).json({ success: true, guests });
  } catch (error) {
    console.error("Admin Get Guests Error:", error);
    return res.status(500).json({ error: "Server error retrieving guests." });
  }
};

const updateGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventId, name, email, phone, status } = req.body;

    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      return res.status(404).json({ error: "Guest not found." });
    }

    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: {
        eventId: eventId || undefined,
        name: name || undefined,
        email: email || undefined,
        phone: phone !== undefined ? phone : undefined,
        status: status || undefined,
      },
    });

    return res.status(200).json({ success: true, guest: updatedGuest });
  } catch (error) {
    console.error("Admin Update Guest Error:", error);
    return res.status(500).json({ error: "Server error updating guest." });
  }
};

const deleteGuest = async (req, res) => {
  try {
    const { id } = req.params;

    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      return res.status(404).json({ error: "Guest not found." });
    }

    await prisma.guest.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Guest deleted successfully." });
  } catch (error) {
    console.error("Admin Delete Guest Error:", error);
    return res.status(500).json({ error: "Server error deleting guest." });
  }
};

/**
 * Admin Invitations management
 */
const getInvitations = async (req, res) => {
  try {
    const rawInvitations = await prisma.invitation.findMany({
      include: {
        event: {
          select: {
            title: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const invitations = rawInvitations.map((inv) => ({
      ...inv,
      eventTitle: inv.event?.title || null,
      eventCreator: inv.event?.user || null,
      event: undefined,
    }));

    return res.status(200).json({ success: true, invitations });
  } catch (error) {
    console.error("Admin Get Invitations Error:", error);
    return res.status(500).json({ error: "Server error retrieving invitations." });
  }
};

const updateInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, mainText, message, status } = req.body;

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found." });
    }

    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        title: title || undefined,
        subtitle: subtitle !== undefined ? subtitle : undefined,
        mainText: mainText !== undefined ? mainText : undefined,
        message: message !== undefined ? message : undefined,
        status: status || undefined,
      },
    });

    return res.status(200).json({ success: true, invitation: updated });
  } catch (error) {
    console.error("Admin Update Invitation Error:", error);
    return res.status(500).json({ error: "Server error updating invitation." });
  }
};

const deleteInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found." });
    }

    await prisma.invitation.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Invitation deleted successfully." });
  } catch (error) {
    console.error("Admin Delete Invitation Error:", error);
    return res.status(500).json({ error: "Server error deleting invitation." });
  }
};

/**
 * Admin Ticketing management
 */
const getTicketing = async (req, res) => {
  try {
    const rawTiers = await prisma.ticketTier.findMany({
      where: {
        status: {
          not: "ARCHIVED",
        },
      },
      include: {
        event: {
          select: {
            title: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        orderItems: {
          where: {
            order: {
              status: "PAID",
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const tiers = rawTiers.map((tier) => {
      const quantitySold = tier.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const remainingQuantity = Math.max(0, tier.capacity - quantitySold);
      const revenueEarned = tier.orderItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice.toString()),
        0.0
      );

      let status = tier.status;
      const now = new Date();
      if (!tier.isActive || tier.status === "INACTIVE") {
        status = "INACTIVE";
      } else if (quantitySold >= tier.capacity) {
        status = "SOLD_OUT";
      } else if (tier.salesStartAt && new Date(tier.salesStartAt) > now) {
        status = "SCHEDULED";
      } else if (tier.salesEndAt && new Date(tier.salesEndAt) < now) {
        status = "EXPIRED";
      } else {
        status = "ACTIVE";
      }

      return {
        id: tier.id,
        eventId: tier.eventId,
        name: tier.name,
        description: tier.description,
        price: parseFloat(tier.price.toString()),
        currency: tier.currency,
        capacity: tier.capacity,
        minPerOrder: tier.minPerOrder,
        maxPerOrder: tier.maxPerOrder,
        salesStartAt: tier.salesStartAt,
        salesEndAt: tier.salesEndAt,
        status,
        isActive: tier.isActive,
        createdAt: tier.createdAt,
        updatedAt: tier.updatedAt,
        quantitySold,
        remainingQuantity,
        revenueEarned,
        eventTitle: tier.event?.title || "General",
        eventCreator: tier.event?.user || null,
      };
    });

    return res.status(200).json({ success: true, tiers });
  } catch (error) {
    console.error("Admin Get Ticketing Error:", error);
    return res.status(500).json({ error: "Server error retrieving ticketing data." });
  }
};

const updateTicketTier = async (req, res) => {
  try {
    const { tierId } = req.params;
    const { name, description, price, capacity, minPerOrder, maxPerOrder, salesStartAt, salesEndAt, status, isActive } = req.body;
    const { Prisma } = require("@prisma/client");

    const tier = await prisma.ticketTier.findUnique({
      where: { id: tierId },
      include: {
        orderItems: {
          where: { order: { status: "PAID" } },
        },
      },
    });

    if (!tier) {
      return res.status(404).json({ error: "Ticket tier not found." });
    }

    const quantitySold = tier.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const newCapacity = parseInt(capacity, 10);
    if (!isNaN(newCapacity) && newCapacity < quantitySold) {
      return res.status(400).json({ error: "Capacity cannot be reduced below the number of tickets already sold." });
    }

    const dbStatus = (status === "SCHEDULED" || status === "SOLD_OUT" || status === "EXPIRED") 
      ? "ACTIVE" 
      : status;

    const updated = await prisma.ticketTier.update({
      where: { id: tierId },
      data: {
        name: name ? name.trim() : undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        price: price !== undefined ? new Prisma.Decimal(String(price)) : undefined,
        capacity: !isNaN(newCapacity) ? newCapacity : undefined,
        minPerOrder: minPerOrder !== undefined ? parseInt(minPerOrder, 10) : undefined,
        maxPerOrder: maxPerOrder !== undefined ? (maxPerOrder ? parseInt(maxPerOrder, 10) : null) : undefined,
        salesStartAt: salesStartAt !== undefined ? (salesStartAt ? new Date(salesStartAt) : null) : undefined,
        salesEndAt: salesEndAt !== undefined ? (salesEndAt ? new Date(salesEndAt) : null) : undefined,
        status: dbStatus !== undefined ? dbStatus : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket tier updated successfully.",
      tier: {
        ...updated,
        price: parseFloat(updated.price.toString()),
      },
    });
  } catch (error) {
    console.error("Admin Update Ticket Tier Error:", error);
    return res.status(500).json({ error: error.message || "Server error updating ticket tier." });
  }
};

const deleteTicketTier = async (req, res) => {
  try {
    const { tierId } = req.params;

    const tier = await prisma.ticketTier.findUnique({
      where: { id: tierId },
      include: {
        orderItems: {
          where: { order: { status: "PAID" } },
        },
      },
    });

    if (!tier) {
      return res.status(404).json({ error: "Ticket tier not found." });
    }

    const quantitySold = tier.orderItems.reduce((sum, item) => sum + item.quantity, 0);

    if (quantitySold > 0) {
      await prisma.ticketTier.update({
        where: { id: tierId },
        data: { status: "ARCHIVED", isActive: false },
      });
      return res.status(200).json({
        success: true,
        deleted: false,
        archived: true,
        message: "Ticket tier archived successfully because it contains sales history.",
      });
    } else {
      await prisma.ticketTier.delete({ where: { id: tierId } });
      return res.status(200).json({
        success: true,
        deleted: true,
        archived: false,
        message: "Ticket tier deleted successfully.",
      });
    }
  } catch (error) {
    console.error("Admin Delete Ticket Tier Error:", error);
    return res.status(500).json({ error: "Server error deleting ticket tier." });
  }
};

/**
 * Admin Check-In management
 */
const getCheckInEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, events });
  } catch (error) {
    console.error("Admin Get Check-In Events Error:", error);
    return res.status(500).json({ error: "Server error retrieving check-in events." });
  }
};

const getCheckInSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    const total = await prisma.guest.count({ where: { eventId } });
    const checkedIn = await prisma.checkIn.count({ where: { eventId } });
    const pending = Math.max(0, total - checkedIn);

    return res.status(200).json({
      success: true,
      summary: { checkedIn, pending, total },
    });
  } catch (error) {
    console.error("Admin Get Check-In Summary Error:", error);
    return res.status(500).json({ error: "Server error retrieving check-in summary." });
  }
};

const getCheckInGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { search = "", status = "all", page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const whereClause = { eventId };

    if (search.trim()) {
      const searchTerm = search.trim();
      const matchingOrders = await prisma.ticketOrder.findMany({
        where: {
          eventId,
          OR: [
            { id: searchTerm },
            { paymentReference: searchTerm },
            { items: { some: { id: searchTerm } } },
          ],
        },
        select: { customerEmail: true },
      });

      const orderEmails = matchingOrders.map((o) => o.customerEmail);

      whereClause.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
        ...(orderEmails.length > 0 ? [{ email: { in: orderEmails } }] : []),
      ];
    }

    if (status === "checked_in") {
      whereClause.checkIns = { some: {} };
    } else if (status === "pending") {
      whereClause.checkIns = { none: {} };
    }

    const totalGuests = await prisma.guest.count({ where: whereClause });
    const guests = await prisma.guest.findMany({
      where: whereClause,
      include: { checkIns: true },
      orderBy: { name: "asc" },
      skip,
      take,
    });

    const guestsWithState = await Promise.all(
      guests.map(async (guest) => {
        const order = await prisma.ticketOrder.findFirst({
          where: {
            eventId: guest.eventId,
            customerEmail: guest.email,
            status: "PAID",
          },
          include: {
            items: {
              include: { ticketTier: true },
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

    return res.status(200).json({
      success: true,
      guests: guestsWithState,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total: totalGuests,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Admin Get Check-In Guests Error:", error);
    return res.status(500).json({ error: "Server error retrieving guests with check-in state." });
  }
};

const checkInGuestManual = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guestId, latitude, longitude } = req.body;
    const { Prisma } = require("@prisma/client");

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId },
    });

    if (!guest) {
      return res.status(404).json({ error: "Guest not found for this event." });
    }

    const existingCheckIn = await prisma.checkIn.findUnique({
      where: { eventId_guestId: { eventId, guestId } },
    });

    if (existingCheckIn) {
      return res.status(409).json({ error: "Guest is already checked in." });
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        eventId,
        guestId,
        method: "MANUAL",
        latitude: latitude ? new Prisma.Decimal(latitude) : null,
        longitude: longitude ? new Prisma.Decimal(longitude) : null,
        checkedInById: String(req.user.id),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      checkIn: {
        ...checkIn,
        latitude: checkIn.latitude ? Number(checkIn.latitude) : null,
        longitude: checkIn.longitude ? Number(checkIn.longitude) : null,
      },
    });
  } catch (error) {
    console.error("Admin Manual Check-In Error:", error);
    return res.status(500).json({ error: "Server error checking in guest manually." });
  }
};

const checkInGuestScan = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrCode, latitude, longitude } = req.body;
    const { Prisma } = require("@prisma/client");

    const isValidUuid = (str) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let guest = null;
    let ticketId = null;

    if (isValidUuid(qrCode)) {
      guest = await prisma.guest.findFirst({
        where: { id: qrCode, eventId },
      });
    }

    if (!guest) {
      const order = await prisma.ticketOrder.findFirst({
        where: { id: qrCode, eventId },
      });

      if (order) {
        if (order.status !== "PAID") {
          return res.status(400).json({
            error: `Ticket order is ${order.status.toLowerCase()}. Only paid tickets are valid.`,
          });
        }

        ticketId = order.id;

        guest = await prisma.guest.findFirst({
          where: { eventId, email: order.customerEmail },
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

    if (!guest) {
      const orderItem = await prisma.ticketOrderItem.findFirst({
        where: {
          id: qrCode,
          order: { eventId },
        },
        include: { order: true },
      });

      if (orderItem) {
        if (orderItem.order.status !== "PAID") {
          return res.status(400).json({
            error: `Ticket order is ${orderItem.order.status.toLowerCase()}. Only paid tickets are valid.`,
          });
        }

        ticketId = orderItem.id;

        guest = await prisma.guest.findFirst({
          where: { eventId, email: orderItem.order.customerEmail },
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

    if (!guest) {
      return res.status(404).json({ error: "Invalid ticket or QR code." });
    }

    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        eventId,
        OR: [{ guestId: guest.id }, ...(ticketId ? [{ ticketId }] : [])],
      },
    });

    if (existingCheckIn) {
      return res.status(409).json({ error: "Guest is already checked in." });
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        eventId,
        guestId: guest.id,
        ticketId,
        method: "QR",
        latitude: latitude ? new Prisma.Decimal(latitude) : null,
        longitude: longitude ? new Prisma.Decimal(longitude) : null,
        checkedInById: String(req.user.id),
      },
    });

    const order = await prisma.ticketOrder.findFirst({
      where: { eventId, customerEmail: guest.email, status: "PAID" },
      include: {
        items: {
          include: { ticketTier: true },
        },
      },
    });

    const ticketTierName = order?.items[0]?.ticketTier?.name || "General";

    return res.status(200).json({
      success: true,
      message: "Check-in successful",
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
    });
  } catch (error) {
    console.error("Admin QR Check-In Error:", error);
    return res.status(500).json({ error: "Server error during QR check-in." });
  }
};

const undoCheckIn = async (req, res) => {
  try {
    const { checkInId } = req.params;

    const checkIn = await prisma.checkIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn) {
      return res.status(404).json({ error: "Check-in record not found." });
    }

    await prisma.checkIn.delete({
      where: { id: checkInId },
    });

    return res.status(200).json({ success: true, message: "Check-in removed successfully" });
  } catch (error) {
    console.error("Admin Undo Check-In Error:", error);
    return res.status(500).json({ error: "Server error undoing check-in." });
  }
};

/**
 * Admin Registries management
 */
const getRegistries = async (req, res) => {
  try {
    const [rawRegistries, totalRegistries, activeRegistries, contributionSummary] = await Promise.all([
      prisma.registry.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          event: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.registry.count(),
      prisma.registry.count({
        where: {
          isActive: true,
        },
      }),
      prisma.registryContribution.aggregate({
        _sum: {
          amount: true,
        },
      }),
    ]);

    const totalContributions = Number(contributionSummary._sum.amount || 0);

    const registries = rawRegistries.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      type: r.type,
      title: r.title,
      description: r.description,
      goalAmount: r.goalAmount !== null ? Number(r.goalAmount) : null,
      currentAmount: Number(r.currentAmount),
      currency: r.currency,
      externalUrl: r.externalUrl,
      contributorCount: r.contributorCount,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      eventTitle: r.event?.title || "General",
      eventCreator: r.user || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        registries,
        stats: {
          totalRegistries,
          activeRegistries,
          totalContributions,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin registries:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load registries",
    });
  }
};

const updateRegistry = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, description, goalAmount, currentAmount, currency, externalUrl, contributorCount, isActive } = req.body;

    const registry = await prisma.registry.findUnique({ where: { id } });
    if (!registry) {
      return res.status(404).json({ error: "Registry not found." });
    }

    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (goalAmount !== undefined) updateData.goalAmount = goalAmount !== null ? Number(goalAmount) : null;
    if (currentAmount !== undefined) updateData.currentAmount = Number(currentAmount);
    if (currency !== undefined) updateData.currency = currency;
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl || null;
    if (contributorCount !== undefined) updateData.contributorCount = Number(contributorCount);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.registry.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Registry updated successfully",
      registry: {
        ...updated,
        goalAmount: updated.goalAmount !== null ? Number(updated.goalAmount) : null,
        currentAmount: Number(updated.currentAmount),
      },
    });
  } catch (error) {
    console.error("Admin Update Registry Error:", error);
    return res.status(500).json({ error: "Server error updating registry." });
  }
};

const deleteRegistry = async (req, res) => {
  try {
    const { id } = req.params;

    const registry = await prisma.registry.findUnique({ where: { id } });
    if (!registry) {
      return res.status(404).json({ error: "Registry not found." });
    }

    await prisma.registry.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Registry deleted successfully" });
  } catch (error) {
    console.error("Admin Delete Registry Error:", error);
    return res.status(500).json({ error: "Server error deleting registry." });
  }
};

module.exports = {
  login,
  logout,
  me,
  getStats,
  getEvents,
  getEventById,
  getEventGuests,
  createEvent,
  updateEvent,
  deleteEvent,
  getGuests,
  updateGuest,
  deleteGuest,
  getInvitations,
  updateInvitation,
  deleteInvitation,
  getTicketing,
  updateTicketTier,
  deleteTicketTier,
  getCheckInEvents,
  getCheckInSummary,
  getCheckInGuests,
  checkInGuestManual,
  checkInGuestScan,
  undoCheckIn,
  getRegistries,
  updateRegistry,
  deleteRegistry,
};
