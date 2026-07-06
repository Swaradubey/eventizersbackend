const express = require("express");
const router = express.Router();
const stripeWebhookController = require("../controllers/stripe.webhook.controller");

// Stripe webhook — raw body is required for signature verification
// The raw body middleware is applied in app.js before express.json()
router.post("/", stripeWebhookController.handleWebhook);

module.exports = router;
