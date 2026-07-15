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
 */
const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required." });
    }

    const order = await ticketPurchaseService.getSessionDetails(sessionId);
    if (!order) {
      return res.status(404).json({ error: "Ticket order not found." });
    }

    // Security check: ensure requesting user owns the order (or is admin)
    if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized access to order details." });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get Session Details Error:", error);
    return res.status(500).json({ error: error.message || "Server error retrieving session details." });
  }
};

module.exports = {
  createCheckoutSession,
  getMyTickets,
  getSessionDetails,
};
