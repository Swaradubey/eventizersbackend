const express = require("express");
const router = express.Router();
const ticketingController = require("../controllers/ticketing.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Retrieve events dropdown list
router.get("/events", ticketingController.getEvents);

// Retrieve summary analytics metrics
router.get("/events/:eventId/summary", ticketingController.getEventSummary);

// Retrieve, create, and manage ticket tiers
router.get("/events/:eventId/tiers", ticketingController.getEventTiers);
router.post("/events/:eventId/tiers", ticketingController.createTicketTier);

router.get("/tiers/:tierId", ticketingController.getTicketTierById);
router.patch("/tiers/:tierId", ticketingController.updateTicketTier);
router.delete("/tiers/:tierId", ticketingController.deleteTicketTier);

module.exports = router;
