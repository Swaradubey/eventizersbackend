const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripe.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create-checkout-session", authMiddleware, stripeController.createCheckoutSession);
router.post("/create-billing-portal-session", authMiddleware, stripeController.createBillingPortalSession);
router.get("/checkout-session/:sessionId", authMiddleware, stripeController.getCheckoutSessionStatus);

module.exports = router;