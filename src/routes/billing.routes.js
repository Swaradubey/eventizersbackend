const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billing.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All billing routes require authentication
router.use(authMiddleware);

/**
 * POST /api/billing/activate-free
 * Activate the Free plan for the authenticated user.
 * Does not create a Stripe subscription. Safe to call multiple times.
 */
router.post("/activate-free", billingController.activateFreePlan);

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe subscription checkout session.
 * Allowed plans: "pro", "business" only.
 */
router.post("/create-checkout-session", billingController.createCheckoutSession);

/**
 * GET /api/billing/verify-session/:sessionId
 * Verify a Stripe Checkout session for the payment success page.
 */
router.get("/verify-session/:sessionId", billingController.verifyCheckoutSession);

/**
 * Invoice download aliases
 */
const userBillingController = require("../controllers/user.billing.controller");
router.get("/invoices/:invoiceId/download", userBillingController.downloadInvoice);
router.get("/invoice/:invoiceId/download", userBillingController.downloadInvoice);

module.exports = router;
