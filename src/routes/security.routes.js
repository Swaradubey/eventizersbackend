const express = require("express");
const router = express.Router();
const securityController = require("../controllers/security.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes with authentication middleware
router.use(authMiddleware);

// Get security stats, alerts, and audit logs
router.get("/dashboard", securityController.getSecurityDashboard);

// Delete an audit log entry
router.delete("/audit-logs/:id", securityController.deleteAuditLog);

module.exports = router;
