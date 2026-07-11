const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all subscription routes with authentication middleware
router.use(authMiddleware);

// Subscribe endpoint
router.post("/subscribe", subscriptionController.subscribe);

// Current plan endpoint
router.get("/current-plan", subscriptionController.getCurrentPlan);

module.exports = router;
