const express = require("express");
const router = express.Router();
const checkInController = require("../controllers/checkIn.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Check-in metrics summary
router.get("/events/:eventId/summary", checkInController.getEventSummary);

// Retrieve guests list with check-in state
router.get("/events/:eventId/guests", checkInController.getEventGuests);

// Manual check-in
router.post("/events/:eventId/manual", checkInController.checkInGuestManual);

// QR scan check-in
router.post("/events/:eventId/scan", checkInController.checkInGuestScan);

// Undo check-in
router.delete("/:checkInId", checkInController.undoCheckIn);

module.exports = router;
