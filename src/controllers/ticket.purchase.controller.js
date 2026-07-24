const ticketPurchaseService = require("../services/ticket.purchase.service");

/**
 * POST /api/tickets/create-checkout-session
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { eventId, ticketTierId, quantity } = req.body;
    const user = req.user; // populated by authMiddleware

    if (!eventId || !ticketTierId) {
      return res.status(400).json({ error: "eventId and ticketTierId are required." });
    }

    const qty = quantity !== undefined ? parseInt(quantity, 10) : 1;

    const sessionData = await ticketPurchaseService.createCheckoutSession(
      eventId,
      ticketTierId,
      qty,
      user
    );

    return res.status(200).json(sessionData);
  } catch (error) {
    console.error("Create Checkout Session Error:", error);
    // Return appropriate HTTP status codes based on business rule errors
    const errMsg = error.message;
    if (
      errMsg.includes("not found") ||
      errMsg.includes("Invalid ticket")
    ) {
      return res.status(404).json({ error: errMsg });
    }
    if (
      errMsg.includes("inactive") ||
      errMsg.includes("Minimum tickets") ||
      errMsg.includes("Maximum tickets") ||
      errMsg.includes("sold out") ||
      errMsg.includes("insufficient")
    ) {
      return res.status(400).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg || "Server error creating checkout session." });
  }
};

/**
 * GET /api/tickets/my-tickets
 */
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.query;
    const tickets = await ticketPurchaseService.getMyTickets(userId, eventId);
    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error("Get My Tickets Error:", error);
    return res.status(500).json({ error: error.message || "Server error fetching user tickets." });
  }
};

/**
 * GET /api/tickets/session/:sessionId
 * POST /api/tickets/verify
 */
const getSessionDetails = async (req, res) => {
  try {
    const sessionId = req.params.sessionId || req.body?.sessionId || req.query?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, status: "failed", message: "Session ID is required." });
    }

    const userId = req.user ? req.user.id : null;
    const result = await ticketPurchaseService.verifyAndGetSessionDetails(sessionId, userId);

    if (result.status === "failed") {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Session Details / Verify Error:", error);
    if (error.statusCode === 403 || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, status: "failed", message: "Unauthorized access to order details." });
    }
    return res.status(500).json({ success: false, status: "failed", message: error.message || "Server error retrieving session details." });
  }
};

const verifyPayment = getSessionDetails;

module.exports = {
  createCheckoutSession,
  getMyTickets,
  getSessionDetails,
  verifyPayment,
};

