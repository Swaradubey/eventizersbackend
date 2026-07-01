const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const eventService = require("../services/event.service");

// Helper function to generate token and set cookie (matches auth.controller.js)
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user.id },
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

    const user = await prisma.user.findUnique({
      where: { email },
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
    const totalEvents = await prisma.event.count();
    const totalGuests = await prisma.guest.count();

    const confirmedGuests = await prisma.guest.count({
      where: { status: "confirmed" },
    });

    const averageRsvpRate = totalGuests > 0 
      ? Math.round((confirmedGuests * 100) / totalGuests) 
      : 0;

    const messagesSent = 0; // Messages count maps to 0 as specified

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

module.exports = {
  login,
  logout,
  me,
  getStats,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
};
