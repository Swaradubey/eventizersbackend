const guestService = require("../services/guest.service");
const eventService = require("../services/event.service");
const db = require("../config/db");

/**
 * Get all guests for the logged-in user
 * GET /api/guests
 */
const getGuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, eventId, page, limit, group } = req.query;

    const parsedPage = page ? Math.max(1, parseInt(page, 10) || 1) : null;
    const parsedLimit = limit ? Math.max(1, parseInt(limit, 10) || 10) : null;

    const { guests, total } = await guestService.findGuestsByUserId(
      userId,
      search,
      eventId,
      parsedPage,
      parsedLimit,
      group
    );

    const paginationMetadata = parsedLimit !== null ? {
      page: parsedPage || 1,
      currentPage: parsedPage || 1,
      limit: parsedLimit,
      total,
      totalCount: total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      hasNextPage: (parsedPage || 1) * parsedLimit < total,
      hasPreviousPage: (parsedPage || 1) > 1,
    } : undefined;

    return res.status(200).json({
      success: true,
      guests,
      data: guests,
      pagination: paginationMetadata,
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
    const { eventId, name, email, phone, status, groups } = req.body;
    const userId = req.user.id;

    // Validate event ID
    if (!eventId) {
      return res.status(400).json({ error: "Please select a valid event." });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      return res.status(400).json({ error: "Invalid event ID format." });
    }

    // Validate guest name
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Guest name is required." });
    }

    // Validate email
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address format." });
    }

    // Validate status
    const validStatuses = ["invited", "confirmed", "declined", "pending"];
    const guestStatus = status || "invited";
    if (!validStatuses.includes(guestStatus)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    // Verify event existence and ownership
    const eventResult = await db.query("SELECT created_by FROM events WHERE id = $1", [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Selected event does not exist." });
    }
    if (eventResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this event." });
    }

    // Check if guest email already exists for this event
    const existingGuest = await guestService.findGuestByEmailAndEventId(email, eventId);
    if (existingGuest) {
      return res.status(409).json({ error: "Guest with this email already exists." });
    }

    // Omit or set null for blank phone numbers
    const cleanPhone = (phone && phone.trim() !== "") ? phone.trim() : null;

    let cleanGroups = undefined;
    if (Array.isArray(groups)) {
      cleanGroups = Array.from(new Set(groups.map((g) => (typeof g === "string" ? g.trim() : "")).filter(Boolean)));
    }

    const newGuest = await guestService.createGuest({
      eventId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      status: guestStatus,
      groups: cleanGroups,
    });

    return res.status(201).json({
      success: true,
      message: "Guest created successfully.",
      guest: newGuest,
    });
  } catch (error) {
    console.error("Create Guest Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
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
    const { eventId, name, email, phone, status, groups } = req.body;
    const userId = req.user.id;

    // Validate UUID format of guest ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid guest ID format." });
    }

    // Validate event ID format if provided
    if (eventId && !uuidRegex.test(eventId)) {
      return res.status(400).json({ error: "Invalid event ID format." });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email address format." });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ["invited", "confirmed", "declined", "pending"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value." });
      }
    }

    // Check if guest exists and belongs to the user
    const existingGuest = await guestService.findGuestById(id, userId);
    if (!existingGuest) {
      return res.status(404).json({ error: "Guest not found or unauthorized access." });
    }

    // If eventId is being modified, verify user owns the new event
    if (eventId && eventId !== existingGuest.eventId) {
      const eventResult = await db.query("SELECT created_by FROM events WHERE id = $1", [eventId]);
      if (eventResult.rows.length === 0) {
        return res.status(404).json({ error: "Target event does not exist." });
      }
      if (eventResult.rows[0].created_by !== userId) {
        return res.status(403).json({ error: "Access denied. You do not own the target event." });
      }
    }

    // If email or eventId is modified, check for duplicates
    const targetEmail = email || existingGuest.email;
    const targetEventId = eventId || existingGuest.eventId;
    if (targetEmail !== existingGuest.email || targetEventId !== existingGuest.eventId) {
      const duplicate = await guestService.findGuestByEmailAndEventId(targetEmail, targetEventId);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: "Guest with this email already exists." });
      }
    }

    // Omit or set null for blank phone numbers
    const cleanPhone = (phone !== undefined) 
      ? ((phone && phone.trim() !== "") ? phone.trim() : null)
      : existingGuest.phone;

    let cleanGroups = undefined;
    if (groups !== undefined) {
      cleanGroups = Array.isArray(groups)
        ? Array.from(new Set(groups.map((g) => (typeof g === "string" ? g.trim() : "")).filter(Boolean)))
        : [];
    }

    const updatedGuest = await guestService.updateGuest(id, {
      eventId: eventId || existingGuest.eventId,
      name: name !== undefined ? name.trim() : existingGuest.name,
      email: email !== undefined ? email.trim().toLowerCase() : existingGuest.email,
      phone: cleanPhone,
      status: status || existingGuest.status,
      groups: cleanGroups,
    });

    return res.status(200).json({
      success: true,
      message: "Guest updated successfully.",
      guest: updatedGuest,
    });
  } catch (error) {
    console.error("Update Guest Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
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

    // Validate event ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      return res.status(400).json({ error: "Invalid event ID format." });
    }

    // Verify event existence and ownership
    const eventResult = await db.query("SELECT created_by FROM events WHERE id = $1", [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Selected event does not exist." });
    }
    if (eventResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this event." });
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
        else if (header === "group" || header === "groups" || header === "tags") {
          guest.groups = columns[index]
            ? columns[index].split(/[;|]/).map((g) => g.trim()).filter(Boolean)
            : [];
        }
      });

      if (guest.name && guest.email) {
        const validStatuses = ["invited", "confirmed", "declined", "pending"];
        if (!guest.status || !validStatuses.includes(guest.status)) {
          guest.status = "invited";
        }
        if (!guest.groups || guest.groups.length === 0) {
          guest.groups = [];
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
    console.error("Import CSV Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return res.status(500).json({ error: "Server error during CSV import." });
  }
};

/**
 * Get all available groups for user with live counts
 * GET /api/guests/groups
 */
const getGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groups, counts } = await guestService.findGroupsByUserId(userId);
    return res.status(200).json({
      success: true,
      groups,
      counts: counts || {},
    });
  } catch (error) {
    console.error("Get Groups Error:", error);
    return res.status(500).json({ error: "Server error retrieving groups." });
  }
};

/**
 * Create a new custom group
 * POST /api/guests/groups
 */
const createGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }
    const group = await guestService.createGroup(userId, name.trim());
    return res.status(201).json({
      success: true,
      message: "Group created successfully.",
      group,
    });
  } catch (error) {
    console.error("Create Group Error:", error);
    return res.status(500).json({ error: "Server error creating group." });
  }
};

/**
 * Delete a custom group
 * DELETE /api/guests/groups/:name
 */
const deleteGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.params;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }
    await guestService.deleteGroup(userId, decodeURIComponent(name.trim()));
    return res.status(200).json({
      success: true,
      message: "Group deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Group Error:", error);
    return res.status(500).json({ error: "Server error deleting group." });
  }
};

/**
 * Update members assigned to a group
 * PUT /api/guests/groups/:name/members
 */
const updateGroupMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.params;
    const { guestIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }

    const decodedName = decodeURIComponent(name.trim());
    const result = await guestService.updateGroupMembers(userId, decodedName, guestIds);

    return res.status(200).json({
      success: true,
      message: `Group "${decodedName}" members updated successfully.`,
      ...result,
    });
  } catch (error) {
    console.error("Update Group Members Error:", error);
    return res.status(500).json({ error: "Server error updating group members." });
  }
};

module.exports = {
  getGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuestsFromCSV,
  getGroups,
  createGroup,
  deleteGroup,
  updateGroupMembers,
};
