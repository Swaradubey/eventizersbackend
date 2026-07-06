const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const billingController = require("../controllers/billing.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Dashboard routes
router.get("/stats", dashboardController.getStats);
router.get("/billing", billingController.getBillingInfo);
router.get("/billing/usage", billingController.getBillingUsage);
router.patch("/billing", billingController.updateBillingInfo);

module.exports = router;
