const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// GET /api/analytics/overview
router.get("/overview", analyticsController.getOverview);

module.exports = router;
