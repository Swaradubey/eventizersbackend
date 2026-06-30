const guestService = require("../services/guest.service");
const eventService = require("../services/event.service");

/**
 * Get all guests for the logged-in user
 * GET /api/guests
 */
const getGuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, eventId } = req.query;

    const guests = await guestService.findGuestsByUserId(userId, search, eventId);
    return res.status(200).json({
      success: true,
      guests,
    });
  } catch (error) {
    console.error("Get Guests Error:", error);
    return res.status(500).json({ error: "Server error retrieving guests." });
  }
};

/**
 * Get a specific guest by ID
 * GET /api/guests/:id
 */
const getGuestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const guest = await guestService.findGuestById(id, userId);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found or unauthorized access." });
    }

    return res.status(200).json({
      success: true,
      guest,
    });
  } catch (error) {
    console.error("Get Guest By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving guest details." });
  }
};

/**
 * Create a new guest
 * POST /api/guests
 */
const createGuest = async (req, res) => {
  try {
    const { eventId, name, email, phone, status } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!eventId || !name || !email) {
      return res.status(400).json({
        error: "Missing required fields. Please provide eventId, name, and email.",
      });
    }

    // Verify event ownership
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    const newGuest = await guestService.createGuest({ eventId, name, email, phone, status });
    return res.status(201).json({
      success: true,
      message: "Guest created successfully.",
      guest: newGuest,
    });
  } catch (error) {
    console.error("Create Guest Error:", error);
    return res.status(500).json({ error: "Server error during guest creation." });
  }
};

/**
 * Update an existing guest
 * PUT /api/guests/:id
 */
const updateGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventId, name, email, phone, status } = req.body;
    const userId = req.user.id;

    // Check if guest exists and belongs to the user
    const existingGuest = await guestService.findGuestById(id, userId);
    if (!existingGuest) {
      return res.status(404).json({ error: "Guest not found or unauthorized access." });
    }

    // If eventId is being modified, verify user owns the new event
    if (eventId && eventId !== existingGuest.eventId) {
      const event = await eventService.findEventByIdAndUserId(eventId, userId);
      if (!event) {
        return res.status(404).json({ error: "Target event not found or unauthorized access." });
      }
    }

    const updatedGuest = await guestService.updateGuest(id, {
      eventId,
      name,
      email,
      phone,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Guest updated successfully.",
      guest: updatedGuest,
    });
  } catch (error) {
    console.error("Update Guest Error:", error);
    return res.status(500).json({ error: "Server error during guest update." });
  }
};

/**
 * Delete a guest
 * DELETE /api/guests/:id
 */
const deleteGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check guest ownership
    const existingGuest = await guestService.findGuestById(id, userId);
    if (!existingGuest) {
      return res.status(404).json({ error: "Guest not found or unauthorized access." });
    }

    const deleted = await guestService.deleteGuest(id);
    if (!deleted) {
      return res.status(404).json({ error: "Failed to delete guest." });
    }

    return res.status(200).json({
      success: true,
      message: "Guest deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Guest Error:", error);
    return res.status(500).json({ error: "Server error during guest deletion." });
  }
};

/**
 * Import guests from a CSV text body
 * POST /api/guests/import/csv
 */
const importGuestsFromCSV = async (req, res) => {
  try {
    const { csvText, eventId } = req.body;
    const userId = req.user.id;

    if (!csvText || !eventId) {
      return res.status(400).json({ error: "Missing required fields csvText or eventId." });
    }

    // Verify event ownership
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(404).json({ error: "Event not found or unauthorized access." });
    }

    // Simple CSV parser
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length <= 1) {
      return res.status(400).json({ error: "CSV is empty or contains no headers." });
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const guestsToInsert = [];

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(",").map((c) => c.trim());
      if (columns.length < headers.length) continue;

      const guest = { eventId };
      headers.forEach((header, index) => {
        if (header === "name") guest.name = columns[index];
        else if (header === "email") guest.email = columns[index];
        else if (header === "phone") guest.phone = columns[index];
        else if (header === "status") guest.status = columns[index];
      });

      if (guest.name && guest.email) {
        const validStatuses = ["invited", "confirmed", "declined", "pending"];
        if (!guest.status || !validStatuses.includes(guest.status)) {
          guest.status = "invited";
        }
        guestsToInsert.push(guest);
      }
    }

    if (guestsToInsert.length === 0) {
      return res.status(400).json({
        error: "No valid guests found in CSV. Please check that headers are exactly 'name' and 'email'.",
      });
    }

    const importedGuests = await guestService.importGuests(guestsToInsert);

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${importedGuests.length} guests.`,
      guests: importedGuests,
    });
  } catch (error) {
    console.error("Import CSV Error:", error);
    return res.status(500).json({ error: "Server error during CSV import." });
  }
};

module.exports = {
  getGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuestsFromCSV,
};
