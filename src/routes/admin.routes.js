const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/auth.middleware");

const requireAuth = authMiddleware;
const requireAdmin = authMiddleware.requireAdmin;

// Public admin login
router.post("/login", adminController.login);

// Protected admin routes
router.use(requireAuth, requireAdmin);

router.post("/logout", adminController.logout);
router.get("/me", adminController.me);
router.get("/dashboard/stats", adminController.getStats);
router.get("/events", adminController.getEvents);
router.get("/events/:eventId/guests", adminController.getEventGuests);
router.get("/events/:id", adminController.getEventById);
router.post("/events", adminController.createEvent);
router.put("/events/:id", adminController.updateEvent);
router.delete("/events/:id", adminController.deleteEvent);

// Admin Guests management
router.get("/guests", adminController.getGuests);
router.put("/guests/:id", adminController.updateGuest);
router.delete("/guests/:id", adminController.deleteGuest);

// Admin Invitations management
router.get("/invitations", adminController.getInvitations);
router.put("/invitations/:id", adminController.updateInvitation);
router.delete("/invitations/:id", adminController.deleteInvitation);

// Admin Ticketing management
router.get("/ticketing", adminController.getTicketing);
router.patch("/ticketing/tiers/:tierId", adminController.updateTicketTier);
router.delete("/ticketing/tiers/:tierId", adminController.deleteTicketTier);

// Admin Check-In management
router.get("/check-ins/events", adminController.getCheckInEvents);
router.get("/check-ins/events/:eventId/summary", adminController.getCheckInSummary);
router.get("/check-ins/events/:eventId/guests", adminController.getCheckInGuests);
router.post("/check-ins/events/:eventId/manual", adminController.checkInGuestManual);
router.post("/check-ins/events/:eventId/scan", adminController.checkInGuestScan);
router.delete("/check-ins/:checkInId", adminController.undoCheckIn);

// Admin Registries management
router.get("/registries", adminController.getRegistries);
router.put("/registries/:id", adminController.updateRegistry);
router.delete("/registries/:id", adminController.deleteRegistry);

// Admin Messages management
const messageController = require("../controllers/message.controller");
router.get("/messages", messageController.adminGetMessages);
router.get("/messages/stats", messageController.adminGetStats);
router.get("/messages/:id", messageController.adminGetMessageById);

module.exports = router;
