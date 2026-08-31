const express = require("express");
const router = express.Router();
const multer = require("multer");
const eventController = require("../controllers/event.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Multer configuration for multipart/form-data with 15MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Event routes
const aiController = require("../controllers/ai.controller");
router.post("/ai-generate", aiController.generateEventWithAI);

router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);
router.post("/", upload.any(), eventController.createEvent);
router.put("/:id", upload.any(), eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// Fetch invitation by event ID
const invitationController = require("../controllers/invitation.controller");
router.get("/:eventId/invitation", invitationController.getInvitationByEvent);

module.exports = router;
