const express = require("express");
const router = express.Router();
const publicController = require("../controllers/public.controller");

// GET /api/public/events/:id - Public event preview details (no authentication required)
router.get("/events/:id", publicController.getPublicEvent);

// POST /api/public/events/:id/rsvp - Submit RSVP response from public preview
router.post("/events/:id/rsvp", publicController.submitPublicRsvp);

module.exports = router;
