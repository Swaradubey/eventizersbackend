const ticketingService = require("../services/ticketing.service");

/**
 * Get all events for the logged-in user (dropdown switcher)
 * GET /api/ticketing/events
 */
const getEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await ticketingService.getEventsByUserId(userId);
    return res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Get Ticketing Events Error:", error);
    return res.status(500).json({ error: "Server error retrieving ticketing events." });
  }
};

/**
 * Get statistics summary for an event
 * GET /api/ticketing/events/:eventId/summary
 */
const getEventSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }

    const summary = await ticketingService.getEventSummary(eventId, userId);
    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Get Event Summary Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Server error retrieving event summary stats." });
  }
};

/**
 * Get all ticket tiers for an event
 * GET /api/ticketing/events/:eventId/tiers
 */
const getEventTiers = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }

    const tiers = await ticketingService.getEventTiers(eventId, userId);
    return res.status(200).json({
      success: true,
      tiers,
    });
  } catch (error) {
    console.error("Get Event Tiers Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Server error retrieving ticket tiers." });
  }
};

/**
 * Get details of a single ticket tier
 * GET /api/ticketing/tiers/:tierId
 */
const getTicketTierById = async (req, res) => {
  try {
    const { tierId } = req.params;
    const userId = req.user.id;

    const tier = await ticketingService.getTicketTierById(tierId, userId);
    if (!tier) {
      return res.status(404).json({ error: "Ticket tier not found." });
    }

    return res.status(200).json({
      success: true,
      tier,
    });
  } catch (error) {
    console.error("Get Ticket Tier By ID Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Server error retrieving ticket tier details." });
  }
};

/**
 * Helper to validate ticket tier fields
 */
const validateTierData = (data) => {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    return "Ticket tier name is required.";
  }

  const price = parseFloat(data.price);
  if (isNaN(price) || price < 0) {
    return "Price must be zero or greater.";
  }

  const capacity = parseInt(data.capacity, 10);
  if (isNaN(capacity) || capacity <= 0) {
    return "Capacity must be a positive integer.";
  }

  const minPerOrder = parseInt(data.minPerOrder, 10);
  if (isNaN(minPerOrder) || minPerOrder < 1) {
    return "Minimum tickets per order must be at least 1.";
  }

  if (data.maxPerOrder !== undefined && data.maxPerOrder !== null && data.maxPerOrder !== "") {
    const maxPerOrder = parseInt(data.maxPerOrder, 10);
    if (isNaN(maxPerOrder) || maxPerOrder < minPerOrder) {
      return "Maximum tickets per order must be greater than or equal to the minimum.";
    }
    if (maxPerOrder > capacity) {
      return "Maximum tickets per order cannot exceed capacity.";
    }
  }

  if (data.salesStartAt) {
    const start = new Date(data.salesStartAt);
    if (isNaN(start.getTime())) {
      return "Invalid sales start date format.";
    }
  }

  if (data.salesEndAt) {
    const end = new Date(data.salesEndAt);
    if (isNaN(end.getTime())) {
      return "Invalid sales end date format.";
    }
  }

  if (data.salesStartAt && data.salesEndAt) {
    const start = new Date(data.salesStartAt);
    const end = new Date(data.salesEndAt);
    if (end <= start) {
      return "Sales end date must be later than sales start date.";
    }
  }

  return null;
};

/**
 * Create a new ticket tier
 * POST /api/ticketing/events/:eventId/tiers
 */
const createTicketTier = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }

    const validationError = validateTierData(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const newTier = await ticketingService.createTicketTier(eventId, req.body, userId);
    return res.status(201).json({
      success: true,
      message: "Ticket tier created successfully.",
      tier: newTier,
    });
  } catch (error) {
    console.error("Create Ticket Tier Error:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }

    // Specific Prisma error handling
    if (error.code === "P2021") {
      console.error("TicketTier database table is missing. Apply the pending Prisma migration.");
      return res.status(500).json({
        success: false,
        message: "Database migration is missing. Please run migrations.",
        error: "Database migration is missing. Please run migrations."
      });
    }
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "A ticket tier with this unique value already exists.",
        error: "A ticket tier with this unique value already exists."
      });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Foreign key constraint failure. Please verify related records.",
        error: "Foreign key constraint failure. Please verify related records."
      });
    }
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Related record not found.",
        error: "Related record not found."
      });
    }
    if (error.code === "P2023") {
      return res.status(400).json({
        success: false,
        message: "Invalid Event ID format.",
        error: "Invalid Event ID format."
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to create the ticket tier. Please try again.",
      error: error.message || "Unable to create the ticket tier. Please try again."
    });
  }
};

/**
 * Update an existing ticket tier
 * PATCH /api/ticketing/tiers/:tierId
 */
const updateTicketTier = async (req, res) => {
  try {
    const { tierId } = req.params;
    const userId = req.user.id;

    const validationError = validateTierData(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const updatedTier = await ticketingService.updateTicketTier(tierId, req.body, userId);
    return res.status(200).json({
      success: true,
      message: "Ticket tier updated successfully.",
      tier: updatedTier,
    });
  } catch (error) {
    console.error("Update Ticket Tier Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Capacity cannot be reduced")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Server error during ticket tier update." });
  }
};

/**
 * Delete or archive a ticket tier
 * DELETE /api/ticketing/tiers/:tierId
 */
const deleteTicketTier = async (req, res) => {
  try {
    const { tierId } = req.params;
    const userId = req.user.id;

    const result = await ticketingService.deleteTicketTier(tierId, userId);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Delete Ticket Tier Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Server error during ticket tier deletion." });
  }
};

module.exports = {
  getEvents,
  getEventSummary,
  getEventTiers,
  getTicketTierById,
  createTicketTier,
  updateTicketTier,
  deleteTicketTier,
};
