const eventService = require("../services/event.service");
const prisma = require("../config/prisma");

/**
 * Get all events for the logged-in user
 * GET /api/events
 */
const getEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await eventService.findEventsByUserId(userId);
    return res.status(200).json({
      success: true,
      events
    });
  } catch (error) {
    console.error("Get Events Error:", error);
    return res.status(500).json({ error: "Server error retrieving events." });
  }
};

/**
 * Get a specific event by ID
 * GET /api/events/:id
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const event = await eventService.findEventByIdAndUserId(id, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    console.error("Get Event By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving event details." });
  }
};

// Template styles matching frontend designs
const TEMPLATE_STYLES = {
  "tpl-birthday-maya": {
    imageUrl: "/assets/templates/birthday.jpg",
    accentColor: "#e07090",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#e07090",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-wedding-liam": {
    imageUrl: "/assets/templates/wedding.jpg",
    accentColor: "#9070c0",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#9070c0",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-corporate-launch": {
    imageUrl: "/assets/templates/corporate.jpg",
    accentColor: "#4080b0",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#4080b0",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-dinner-party": {
    imageUrl: "/assets/templates/dinner.jpg",
    accentColor: "#907030",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#907030",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-baby-shower": {
    imageUrl: "/assets/templates/babyshower.jpg",
    accentColor: "#4a9a4a",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#4a9a4a",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-charity-gala": {
    imageUrl: "/assets/templates/gala.jpg",
    accentColor: "#a07820",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#a07820",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-live-music": {
    imageUrl: "/assets/templates/music.jpg",
    accentColor: "#9970d0",
    backgroundColor: "#2D1B3D",
    textColor: "#FAF8F5",
    titleSize: 52,
    fontWeight: "700",
    fontFamily: "Inter",
    buttonColor: "#9970d0",
    buttonRadius: 16,
    textAlignment: "center",
  },
  "tpl-anniversary-james": {
    imageUrl: "/assets/templates/anniversary.jpg",
    accentColor: "#c06840",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#c06840",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-grad-gala": {
    imageUrl: "/assets/templates/graduation_gala.jpg",
    accentColor: "#d4af37",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#1e3c72",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-grad-class2026": {
    imageUrl: "/assets/templates/graduation_class_2026.jpg",
    accentColor: "#e67e22",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#d35400",
    buttonRadius: 12,
    textAlignment: "center",
  },
  "tpl-grad-degree": {
    imageUrl: "/assets/templates/graduation_degree.jpg",
    accentColor: "#1abc9c",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#203a43",
    buttonRadius: 6,
    textAlignment: "center",
  },
  "tpl-comm-meetup": {
    imageUrl: "/assets/templates/community_meetup.jpg",
    accentColor: "#11998e",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#11998e",
    buttonRadius: 20,
    textAlignment: "center",
  },
  "tpl-comm-celebration": {
    imageUrl: "/assets/templates/community_celebration.jpg",
    accentColor: "#ff5e62",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#ff5e62",
    buttonRadius: 14,
    textAlignment: "center",
  },
  "tpl-comm-volunteer": {
    imageUrl: "/assets/templates/community_volunteer.jpg",
    accentColor: "#e91e63",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 48,
    fontWeight: "700",
    fontFamily: "Playfair Display",
    buttonColor: "#e91e63",
    buttonRadius: 10,
    textAlignment: "center",
  },
  "tpl-net-professional": {
    imageUrl: "/assets/templates/networking_professional.jpg",
    accentColor: "#6f86d6",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#4e4376",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-net-founders": {
    imageUrl: "/assets/templates/networking_founders.jpg",
    accentColor: "#00c6ff",
    backgroundColor: "#2D1B3D",
    textColor: "#FAF8F5",
    titleSize: 46,
    fontWeight: "700",
    fontFamily: "Inter",
    buttonColor: "#00c6ff",
    buttonRadius: 8,
    textAlignment: "center",
  },
  "tpl-net-connections": {
    imageUrl: "/assets/templates/networking_connections.jpg",
    accentColor: "#3a7bd5",
    backgroundColor: "#FAF8F5",
    textColor: "#2D1B3D",
    titleSize: 44,
    fontWeight: "600",
    fontFamily: "Inter",
    buttonColor: "#3a6073",
    buttonRadius: 10,
    textAlignment: "center",
  }
};

/**
 * Create a new event
 * POST /api/events
 */
const createEvent = async (req, res) => {
  try {
    const { title, eventDate, eventTime, venue, selectedTemplateId, templateId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({ 
        error: "Missing required fields. Please provide title, date, time, and venue." 
      });
    }

    const effectiveTemplateId = selectedTemplateId || templateId;

    const newEvent = await eventService.createEvent({
      ...req.body,
      selectedTemplateId: effectiveTemplateId
    }, userId);

    // Automatically create invitation if templateId is provided
    if (effectiveTemplateId) {
      const template = await prisma.template.findUnique({ where: { id: effectiveTemplateId } });
      if (template) {
        let design = {};
        try {
          design = JSON.parse(template.content);
        } catch (e) {
          console.error("Failed to parse template content:", e);
        }

        const style = TEMPLATE_STYLES[effectiveTemplateId] || {};

        await prisma.invitation.create({
          data: {
            eventId: newEvent.id,
            title: newEvent.title,
            subtitle: newEvent.venue || "TBD",
            mainText: design.description || newEvent.description || "Join us for an unforgettable experience filled with joy and celebration. Please RSVP using the button below to secure your spot.",
            message: design.description || newEvent.description || "",
            accentColor: style.accentColor || design.accentColor || "#5B5FEF",
            backgroundColor: style.backgroundColor || design.backgroundColor || "#FAF8F5",
            textColor: style.textColor || "#2D1B3D",
            titleSize: style.titleSize || 48,
            fontWeight: style.fontWeight || "700",
            fontFamily: style.fontFamily || "Playfair Display",
            textAlignment: style.textAlignment || "center",
            imageUrl: style.imageUrl || null,
            buttonText: "RSVP Now",
            buttonColor: style.buttonColor || style.accentColor || "#5B5FEF",
            buttonRadius: style.buttonRadius || 12,
            status: "draft"
          }
        });
      }
    }

    // Log event creation
    const { createAuditLog } = require("../utils/auditLogger");
    await createAuditLog({
      userId,
      action: "EVENT_CREATED",
      eventId: newEvent.id
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: newEvent
    });
  } catch (error) {
    console.error("Create Event Error:", error);
    return res.status(500).json({ error: error.message || "Server error during event creation." });
  }
};

/**
 * Update an existing event
 * PUT /api/events/:id
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, eventDate, eventTime, venue } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({ 
        error: "Missing required fields. Please provide title, date, time, and venue." 
      });
    }

    const updatedEvent = await eventService.updateEvent(id, req.body, userId);
    if (!updatedEvent) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    // Log event update
    const { createAuditLog } = require("../utils/auditLogger");
    await createAuditLog({
      userId,
      action: "EVENT_UPDATED",
      eventId: updatedEvent.id
    });

    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      event: updatedEvent
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    return res.status(500).json({ error: "Server error during event update." });
  }
};

/**
 * Delete an event
 * DELETE /api/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await eventService.deleteEvent(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully."
    });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return res.status(500).json({ error: "Server error during event deletion." });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
