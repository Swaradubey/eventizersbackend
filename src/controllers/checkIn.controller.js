const checkInService = require("../services/checkIn.service");

/**
 * Helper to handle Prisma/general errors safely and return consistent error payloads
 */
const handleError = (error, res, context = {}) => {
  const { endpoint, eventId, userId } = context;

  // Log safe debugging info in the console
  console.error(`Check-In Controller Error [${endpoint}]:`, {
    code: error.code,
    message: error.message,
    status: error.status,
    eventId,
    userId,
  });

  if (res.headersSent) return;

  // Handle errors that have a custom status set (e.g. from service)
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  // Handle specific Prisma errors
  if (error.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "Guest is already checked in.",
    });
  }
  if (error.code === "P2003") {
    return res.status(400).json({
      success: false,
      message: "Invalid association. Please verify related records.",
    });
  }
  if (error.code === "P2025" || error.code === "P2018") {
    return res.status(404).json({
      success: false,
      message: "Required database record not found.",
    });
  }
  if (error.code === "P2021" || error.code === "P2022") {
    return res.status(500).json({
      success: false,
      message: "Database schema mismatch. Please apply pending migrations.",
    });
  }

  // Standard fallback
  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred on the server.",
  });
};

/**
 * Get check-in summary statistics
 * GET /api/check-ins/events/:eventId/summary
 */
const getEventSummary = async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.id;

  try {
    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required." });
    }

    const summary = await checkInService.getCheckInSummary(eventId, userId);
    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    return handleError(error, res, { endpoint: "getEventSummary", eventId, userId });
  }
};

/**
 * Get event guests list with check-in state
 * GET /api/check-ins/events/:eventId/guests
 */
const getEventGuests = async (req, res) => {
  const { eventId } = req.params;
  const { search, status, page, limit } = req.query;
  const userId = req.user.id;

  try {
    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required." });
    }

    const data = await checkInService.getGuestsWithCheckInState(eventId, userId, {
      search,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    return handleError(error, res, { endpoint: "getEventGuests", eventId, userId });
  }
};

/**
 * Manual guest check-in
 * POST /api/check-ins/events/:eventId/manual
 */
const checkInGuestManual = async (req, res) => {
  const { eventId } = req.params;
  const { guestId, latitude, longitude } = req.body;
  const userId = req.user.id;

  try {
    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required." });
    }
    if (!guestId) {
      return res.status(400).json({ success: false, error: "Guest ID is required." });
    }

    const checkIn = await checkInService.checkInGuestManual(
      eventId,
      guestId,
      latitude,
      longitude,
      userId
    );

    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      checkIn,
    });
  } catch (error) {
    return handleError(error, res, { endpoint: "checkInGuestManual", eventId, userId });
  }
};

/**
 * QR ticket scan check-in
 * POST /api/check-ins/events/:eventId/scan
 */
const checkInGuestScan = async (req, res) => {
  const { eventId } = req.params;
  const { qrCode, latitude, longitude } = req.body;
  const userId = req.user.id;

  try {
    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required." });
    }
    if (!qrCode) {
      return res.status(400).json({ success: false, error: "QR code token is required." });
    }

    const data = await checkInService.checkInGuestScan(
      eventId,
      qrCode,
      latitude,
      longitude,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Check-in successful",
      guest: data.guest,
      checkIn: data.checkIn,
    });
  } catch (error) {
    return handleError(error, res, { endpoint: "checkInGuestScan", eventId, userId });
  }
};

/**
 * Undo check-in
 * DELETE /api/check-ins/:checkInId
 */
const undoCheckIn = async (req, res) => {
  const { checkInId } = req.params;
  const userId = req.user.id;

  try {
    if (!checkInId) {
      return res.status(400).json({ success: false, error: "Check-in ID is required." });
    }

    await checkInService.undoCheckIn(checkInId, userId);

    return res.status(200).json({
      success: true,
      message: "Check-in removed successfully",
    });
  } catch (error) {
    return handleError(error, res, { endpoint: "undoCheckIn", userId });
  }
};

module.exports = {
  getEventSummary,
  getEventGuests,
  checkInGuestManual,
  checkInGuestScan,
  undoCheckIn,
};
