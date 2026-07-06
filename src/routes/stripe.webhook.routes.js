const express = require("express");
const router = express.Router();
const stripeWebhookController = require("../controllers/stripe.webhook.controller");


router.post("/", stripeWebhookController.handleWebhook);

module.exports = router;
