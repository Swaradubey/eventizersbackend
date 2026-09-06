const express = require("express");
const router = express.Router();
const checkInController = require("../controllers/checkIn.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public guest QR check-in verification endpoints (accessible via mobile scan without dashboard login)
router.get("/verify/:guestId", checkInController.verifyGuestCheckIn);
router.post("/verify/:guestId", checkInController.verifyGuestCheckIn);
router.get("/guest/:guestId", checkInController.verifyGuestCheckIn);
router.post("/guest/:guestId", checkInController.verifyGuestCheckIn);

// Protect dashboard & admin check-in management routes with authMiddleware
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
