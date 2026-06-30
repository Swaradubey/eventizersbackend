const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Dashboard routes
router.get("/stats", dashboardController.getStats);

module.exports = router;
