const stripe = require("../config/stripe");
const db = require("../config/db");
const userBillingService = require("../services/user.billing.service");
const billingService = require("../services/billing.service");

/**
 * Capitalize the first letter of a string.
 */
const capitalizeFirst = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events.
 */
const handleWebhook = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured." });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header." });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "payment_method.attached":
        await handlePaymentMethodAttached(event.data.object);
        break;

      case "payment_method.detached":
        await handlePaymentMethodDetached(event.data.object);
        break;

      case "customer.updated":
        await handleCustomerUpdated(event.data.object);
        break;

      case "invoice.created":
        await handleInvoiceCreated(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event.data.object);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[webhook] Error handling event ${event.type}:`, err.message);
    // Return 200 to acknowledge receipt — Stripe will retry on non-2xx
  }

  return res.status(200).json({ received: true });
};

/**
 * Handle payment_method.attached event.
 */
const handlePaymentMethodAttached = async (paymentMethod) => {
  const customerId = paymentMethod.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  await userBillingService.syncPaymentMethodToDb(userId, paymentMethod, false);
  console.log(`[webhook] Payment method ${paymentMethod.id} attached for user ${userId}`);
};

/**
 * Handle payment_method.detached event.
 */
const handlePaymentMethodDetached = async (paymentMethod) => {
  // Remove from local DB
  await db.query(
    `DELETE FROM payment_methods WHERE stripe_payment_method_id = $1`,
    [paymentMethod.id]
  );
  console.log(`[webhook] Payment method ${paymentMethod.id} detached and removed from DB`);
};

/**
 * Handle customer.updated event — sync default payment method.
 */
const handleCustomerUpdated = async (customer) => {
  if (customer.deleted) return;

  const userResult = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1`,
    [customer.id]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  const defaultPmId = customer.invoice_settings?.default_payment_method;

  if (defaultPmId) {
    // Unset all defaults for user, then set the correct one
    await db.query(
      `UPDATE payment_methods SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    await db.query(
      `UPDATE payment_methods SET is_default = TRUE, updated_at = NOW() WHERE user_id = $1 AND stripe_payment_method_id = $2`,
      [userId, defaultPmId]
    );
    console.log(`[webhook] Default PM updated to ${defaultPmId} for user ${userId}`);
  }
};

/**
 * Shared helper to insert/update invoices in the DB.
 */
const upsertInvoice = async (invoice, statusOverride = null) => {
  const customerId = invoice.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  const invoiceId = invoice.id;
  const invoiceNumber = invoice.number || invoiceId;
  const amount = (invoice.amount_paid || invoice.amount_due || 0) / 100;
  const currency = (invoice.currency || "usd").toUpperCase();
  const status = statusOverride || capitalizeFirst(invoice.status || "Draft");
  const invoiceDate = new Date((invoice.created || Date.now()) * 1000).toISOString().split("T")[0];
  const pdfUrl = invoice.invoice_pdf || `/api/user/billing/invoices/${invoiceId}/download`;

  // Upsert invoice
  const existing = await db.query(`SELECT id FROM invoices WHERE id = $1`, [invoiceId]);

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE invoices SET status = $1, amount = $2, pdf_url = $3, updated_at = NOW() WHERE id = $4`,
      [status, amount, pdfUrl, invoiceId]
    );
  } else {
    await db.query(
      `INSERT INTO invoices (id, invoice_number, user_id, stripe_invoice_id, amount, currency, status, invoice_date, pdf_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [invoiceId, invoiceNumber, userId, invoiceId, amount, currency, status, invoiceDate, pdfUrl]
    );
  }

  console.log(`[webhook] Invoice ${invoiceNumber} (${status}) upserted for user ${userId}`);
};

/**
 * Handle invoice.created event — upsert invoice.
 */
const handleInvoiceCreated = async (invoice) => {
  await upsertInvoice(invoice);
};

/**
 * Handle invoice.payment_succeeded event — mark invoice as Paid.
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  await upsertInvoice(invoice, "Paid");
};

/**
 * Handle invoice.payment_failed event — mark invoice as Failed.
 */
const handleInvoicePaymentFailed = async (invoice) => {
  await upsertInvoice(invoice, "Failed");
};

/**
 * Handle customer.subscription.created and customer.subscription.updated events.
 */
const handleSubscriptionCreatedOrUpdated = async (subscription) => {
  const customerId = subscription.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id, plan, stripe_subscription_id FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  const planId = subscription.metadata?.planId || "free";

  // If the subscription is active/trialing, keep/update the plan, otherwise fall back to free
  const status = subscription.status;
  let localPlan = planId.toLowerCase();
  if (status === "canceled" || status === "unpaid") {
    localPlan = "free";
  }

  // Update subscription reference in user table
  const subscriptionId = status === "canceled" ? null : subscription.id;
  await db.query(
    `UPDATE users SET stripe_subscription_id = $1 WHERE id = $2`,
    [subscriptionId, userId]
  );

  // Synchronize database local plan limits
  await billingService.updatePlanByUserId(userId, localPlan);

  console.log(`[webhook] Subscription ${subscription.id} status updated to ${status} for user ${userId}. Plan set to ${localPlan}.`);
};

module.exports = {
  handleWebhook,
};
