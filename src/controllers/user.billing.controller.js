const userBillingService = require("../services/user.billing.service");
const { generateInvoicePdfBuffer } = require("../services/invoicePdf.service");
const db = require("../config/db");
const axios = require("axios");

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
        error: "Invoice ID parameter is required.",
      });
    }

    const invoice = await userBillingService.getInvoiceByIdAndUser(userId, invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found or unauthorized access.",
      });
    }

    // Fetch user details for invoice enrichment
    let user = null;
    try {
      const userRes = await db.query(
        "SELECT id, name, email, plan FROM users WHERE id = $1",
        [userId]
      );
      user = userRes.rows[0] || null;
    } catch (userErr) {
      console.warn("[billing] Could not fetch user details for PDF:", userErr.message);
    }

    const filename = `invoice-${invoice.invoice_number || invoice.id || invoiceId}.pdf`;

    // 1. If Stripe hosted invoice_pdf URL is available and is a direct PDF link:
    // Proxy/fetch the PDF directly on server to prevent browser CORS header issues
    if (
      invoice.pdf_url &&
      invoice.pdf_url.startsWith("https://") &&
      (invoice.pdf_url.includes(".pdf") ||
        invoice.pdf_url.includes("/pdf") ||
        invoice.pdf_url.includes("files.stripe.com"))
    ) {
      try {
        const stripePdfRes = await axios.get(invoice.pdf_url, {
          responseType: "arraybuffer",
          timeout: 10000,
        });

        if (stripePdfRes.status === 200 && stripePdfRes.data) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          res.setHeader("Content-Length", stripePdfRes.data.length);
          return res.send(Buffer.from(stripePdfRes.data));
        }
      } catch (proxyErr) {
        console.warn(
          "[billing] Could not fetch hosted PDF from Stripe URL, falling back to dynamic generator:",
          proxyErr.message
        );
      }
    }

    // 2. Generate server-side dynamic PDF receipt using PDFKit
    try {
      const pdfBuffer = await generateInvoicePdfBuffer(invoice, user);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (genErr) {
      console.error("[billing] PDF generator error:", genErr);
      return res.status(500).json({
        success: false,
        error: "Failed to generate invoice PDF receipt.",
      });
    }
  } catch (error) {
    console.error("Download Invoice Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error downloading invoice PDF.",
    });
  }
};

/**
 * DELETE /api/user/billing/invoices/:invoiceId
 */
const deleteInvoice = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { invoiceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized access.",
      });
    }

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: "Invoice ID parameter is required.",
      });
    }

    const deleted = await userBillingService.deleteInvoice(userId, invoiceId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Invoice record not found or already removed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice record removed successfully",
      data: {
        id: deleted.id,
        invoiceNumber: deleted.invoice_number,
      },
    });
  } catch (error) {
    console.error("Delete Invoice Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error removing invoice record.",
    });
  }
};

module.exports = {
  getPaymentMethod,
  createSetupIntent,
  updatePaymentMethod,
  getInvoices,
  downloadInvoice,
  deleteInvoice,
};

