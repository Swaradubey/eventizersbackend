const eventService = require("../services/event.service");

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

/**
 * Create a new event
 * POST /api/events
 */
const createEvent = async (req, res) => {
  try {
    const { title, eventDate, eventTime, venue } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !venue) {
      return res.status(400).json({ 
        error: "Missing required fields. Please provide title, date, time, and venue." 
      });
    }

    const newEvent = await eventService.createEvent(req.body, userId);
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
