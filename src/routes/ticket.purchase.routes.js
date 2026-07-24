const express = require("express");
const router = express.Router();
const ticketPurchaseController = require("../controllers/ticket.purchase.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router
router.use(authMiddleware);

// Route for creating a checkout session
router.post("/create-checkout-session", ticketPurchaseController.createCheckoutSession);

// Route for retrieving the user's purchased tickets
router.get("/my-tickets", ticketPurchaseController.getMyTickets);

// Route for retrieving session details & verifying payment
router.get("/session/:sessionId", ticketPurchaseController.getSessionDetails);
router.get("/verify/:sessionId", ticketPurchaseController.verifyPayment);
router.post("/verify", ticketPurchaseController.verifyPayment);

module.exports = router;

