const userBillingService = require("../services/user.billing.service");

/**
 * GET /api/user/billing/payment-method
 */
const getPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await userBillingService.getPaymentMethod(userId);

    if (!data) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Payment Method Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving payment method.",
    });
  }
};

/**
 * POST /api/user/billing/setup-intent
 * Create a Stripe SetupIntent so the frontend can collect card details.
 */
const createSetupIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userBillingService.createSetupIntent(userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Create SetupIntent Error:", error);

    if (error.message?.includes("Stripe is not configured")) {
      return res.status(503).json({
        success: false,
        error: "Payment service is not available. Please try again later.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error creating setup intent.",
    });
  }
};

/**
 * POST /api/user/billing/payment-method
 * Attach a Stripe PaymentMethod and set as default.
 */
const updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;

    if (!paymentMethodId || typeof paymentMethodId !== "string" || paymentMethodId.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "paymentMethodId is required and must be a non-empty string.",
      });
    }

    const data = await userBillingService.updatePaymentMethod(userId, paymentMethodId.trim());
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Update Payment Method Error:", error);

    // Handle Stripe-specific errors
    if (error.type === "StripeCardError") {
      return res.status(400).json({
        success: false,
        error: error.message || "Your card was declined.",
      });
    }

    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        success: false,
        error: error.message || "Invalid payment method.",
      });
    }

    if (error.message?.includes("Stripe is not configured")) {
      return res.status(503).json({
        success: false,
        error: "Payment service is not available. Please try again later.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error updating payment method.",
    });
  }
};

/**
 * GET /api/user/billing/invoices
 */
const getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const result = await userBillingService.getInvoices(userId, page, limit);
    return res.status(200).json({
      success: true,
      invoices: result.invoices,
      pagination: {
        currentPage: result.currentPage,
        pageSize: limit,
        totalInvoices: result.totalInvoices,
        totalPages: result.totalPages,
        hasNextPage: result.currentPage < result.totalPages,
        hasPreviousPage: result.currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get Invoices Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving invoices.",
    });
  }
};

/**
 * GET /api/user/billing/invoices/:invoiceId/download
 */
const downloadInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: "invoiceId parameter is required.",
      });
    }

    const invoice = await userBillingService.getInvoiceByIdAndUser(userId, invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found or unauthorized access.",
      });
    }

    // If Stripe PDF URL is available and starts with https, redirect
    if (invoice.pdf_url && invoice.pdf_url.startsWith("https://")) {
      return res.redirect(invoice.pdf_url);
    }

    // Generate a simple, valid minimal PDF buffer dynamically
    const invoiceDateStr = new Date(invoice.invoice_date).toDateString();
    const pdfBuffer = Buffer.from(
      `%PDF-1.4\n` +
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj\n` +
      `4 0 obj\n<< /Length 170 >>\nstream\n` +
      `BT\n/F1 14 Tf\n50 700 Td\n(INVITEHUB BILLING SYSTEM) Tj\n0 -30 Td\n/F1 12 Tf\n(Invoice Number: ${invoice.invoice_number}) Tj\n0 -20 Td\n(Date: ${invoiceDateStr}) Tj\n0 -20 Td\n(Amount Paid: ${invoice.amount} ${invoice.currency}) Tj\n0 -20 Td\n(Status: ${invoice.status}) Tj\n0 -30 Td\n(Thank you for your business!) Tj\nET\n` +
      `endstream\nendobj\n` +
      `xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000212 00000 n\n` +
      `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n435\n%%EOF`
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Download Invoice Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error downloading invoice PDF.",
    });
  }
};

module.exports = {
  getPaymentMethod,
  createSetupIntent,
  updatePaymentMethod,
  getInvoices,
  downloadInvoice,
};
