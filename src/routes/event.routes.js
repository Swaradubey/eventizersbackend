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

const { restrictGuest } = authMiddleware;

// Event routes
const aiController = require("../controllers/ai.controller");
router.post("/ai-generate", restrictGuest, aiController.generateEventWithAI);

router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);
router.post("/", restrictGuest, upload.any(), eventController.createEvent);
router.put("/:id", restrictGuest, upload.any(), eventController.updateEvent);
router.delete("/:id", restrictGuest, eventController.deleteEvent);

// RSVP Settings routes
router.get("/:id/rsvp-settings", eventController.getRsvpSettings);
router.put("/:id/rsvp-settings", restrictGuest, eventController.updateRsvpSettings);

// Design & Fonts Settings routes
router.get("/:id/design", eventController.getDesignSettings);
router.put("/:id/design", restrictGuest, eventController.updateDesignSettings);
router.patch("/:id/design", restrictGuest, eventController.updateDesignSettings);

// Send invitations route
router.post("/:id/send-invitations", restrictGuest, eventController.sendEventInvitations);

// Event Reminders routes
router.get("/:id/reminders", eventController.getEventReminders);
router.put("/:id/reminders", restrictGuest, eventController.updateEventReminders);

// Fetch invitation by event ID
const invitationController = require("../controllers/invitation.controller");
router.get("/:eventId/invitation", invitationController.getInvitationByEvent);

// Attendance Commitment & Reservation Guarantee routes
const securityController = require("../controllers/security.controller");
router.get("/:eventId/attendance-commitment", eventController.getAttendanceCommitment);
router.get("/:id/attendance-commitment", eventController.getAttendanceCommitment);
router.put("/:id/reservation-guarantee", restrictGuest, securityController.updateAttendanceGuarantee);
router.patch("/:id/reservation-guarantee", restrictGuest, securityController.updateAttendanceGuarantee);
router.post("/:id/reservation-guarantee", restrictGuest, securityController.updateAttendanceGuarantee);
router.put("/:id/attendance-guarantee", restrictGuest, securityController.updateAttendanceGuarantee);
router.put("/:id/attendance-commitment", restrictGuest, securityController.updateAttendanceGuarantee);
router.patch("/:id/attendance-commitment", restrictGuest, securityController.updateAttendanceGuarantee);

// GPS Check-In routes
router.post("/:id/gps-checkin", eventController.gpsCheckIn);
router.get("/:id/arrivals", eventController.getLiveArrivals);
router.patch("/:id/geofence", restrictGuest, eventController.updateGeofenceRadius);

module.exports = router;

