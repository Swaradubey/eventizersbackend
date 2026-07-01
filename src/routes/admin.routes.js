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
router.get("/events/:id", adminController.getEventById);
router.post("/events", adminController.createEvent);
router.put("/events/:id", adminController.updateEvent);
router.delete("/events/:id", adminController.deleteEvent);

module.exports = router;
