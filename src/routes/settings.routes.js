const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settings.controller");
const authMiddleware = require("../middleware/auth.middleware");

const requireAuth = authMiddleware;
const requireAdmin = authMiddleware.requireAdmin;

// Enforce auth & admin role globally for settings routes
router.use(requireAuth, requireAdmin);

// Profile
router.get("/profile", settingsController.getProfile);
router.put("/profile", settingsController.updateProfile);

// Notifications
router.get("/notifications", settingsController.getNotifications);
router.put("/notifications", settingsController.updateNotifications);

// Security
router.get("/security", settingsController.getSecurity);
router.put("/security", settingsController.updateSecurity);
router.post("/change-password", settingsController.changePassword);

// Team
router.get("/team", settingsController.getTeam);
router.post("/team", settingsController.addTeamMember);
router.put("/team/:id", settingsController.updateTeamMember);
router.delete("/team/:id", settingsController.removeTeamMember);

// Preferences
router.get("/preferences", settingsController.getPreferences);
router.put("/preferences", settingsController.updatePreferences);

module.exports = router;
