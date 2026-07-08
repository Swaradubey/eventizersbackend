const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Event routes
const aiController = require("../controllers/ai.controller");
router.post("/ai-generate", aiController.generateEvent);

router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);
router.post("/", eventController.createEvent);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// Fetch invitation by event ID
const invitationController = require("../controllers/invitation.controller");
router.get("/:eventId/invitation", invitationController.getInvitationByEvent);

module.exports = router;
