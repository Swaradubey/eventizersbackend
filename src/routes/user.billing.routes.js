const express = require("express");
const router = express.Router();
const userBillingController = require("../controllers/user.billing.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all user billing routes with authentication
router.use(authMiddleware);

// Payment Method Routes
router.get("/payment-method", userBillingController.getPaymentMethod);
router.post("/payment-method", userBillingController.updatePaymentMethod);
router.put("/payment-method", userBillingController.updatePaymentMethod);

// SetupIntent Route
router.post("/setup-intent", userBillingController.createSetupIntent);

// Invoices Routes
router.get("/invoices", userBillingController.getInvoices);
router.get("/invoices/:invoiceId/download", userBillingController.downloadInvoice);

module.exports = router;
