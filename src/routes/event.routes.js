const express = require("express");
const router = express.Router();
const multer = require("multer");
const eventController = require("../controllers/event.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Multer configuration for multipart/form-data with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Event routes
const aiController = require("../controllers/ai.controller");
router.post("/ai-generate", aiController.generateEventWithAI);

router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);
router.post("/", upload.single("coverImage"), eventController.createEvent);
router.put("/:id", upload.single("coverImage"), eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// Fetch invitation by event ID
const invitationController = require("../controllers/invitation.controller");
router.get("/:eventId/invitation", invitationController.getInvitationByEvent);

module.exports = router;
