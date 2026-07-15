const stripe = require("../config/stripe");
const db = require("../config/db");
const prisma = require("../config/prisma");
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
      process.env.STRIPE_WEBHOOK_SECRET.trim()
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

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
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
 * Handle invoice.created event — upsert invoice.
 */
const handleInvoiceCreated = async (invoice) => {
  await userBillingService.upsertInvoice(invoice);
};

/**
 * Handle invoice.payment_succeeded event — mark invoice as Paid.
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  // First, upsert the invoice
  await userBillingService.upsertInvoice(invoice, "Paid");


  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  if (customerId && subscriptionId) {
    const userResult = await db.query(
      `SELECT id, plan FROM users WHERE stripe_customer_id = $1`,
      [customerId]
    );
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;

      // Resolve plan from invoice lines
      let planId = "pro"; // Default fallback
      if (invoice.lines?.data?.length > 0) {
        const lineItem = invoice.lines.data[0];
        const priceId = lineItem.price?.id;
        if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID?.trim()) {
          planId = "business";
        } else if (priceId === process.env.STRIPE_PRO_PRICE_ID?.trim()) {
          planId = "pro";
        } else if (lineItem.description) {
          const desc = lineItem.description.toLowerCase();
          if (desc.includes("business")) {
            planId = "business";
          } else if (desc.includes("pro")) {
            planId = "pro";
          }
        }
      }

      // Update user plan to PRO/BUSINESS and sync limits
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE users SET stripe_subscription_id = $1, plan = $2 WHERE id = $3`,
          [subscriptionId, planId.toUpperCase(), userId]
        );
        await billingService.updatePlanByUserId(userId, planId.toLowerCase(), client);
        await client.query("COMMIT");
        console.log(`[webhook] Invoice payment succeeded. Updated user ${userId} plan to ${planId.toUpperCase()}.`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[webhook] Failed to update user plan on invoice payment success:`, err.message);
      } finally {
        client.release();
      }
    }
  }
};

/**
 * Handle invoice.payment_failed event — mark invoice as Failed.
 */
const handleInvoicePaymentFailed = async (invoice) => {
  await userBillingService.upsertInvoice(invoice, "Failed");
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
  const status = subscription.status;
  const planFromMetadata = subscription.metadata?.plan || subscription.metadata?.planId;

  // Determine plan from metadata, or derive from price ID
  let planId = planFromMetadata || null;
  if (!planId && subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId === process.env.STRIPE_PRO_PRICE_ID?.trim()) {
      planId = "pro";
    } else if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID?.trim()) {
      planId = "business";
    }
  }

  let localPlan = planId ? planId.toLowerCase() : "free";


  if (status === "active" || status === "trialing") {
    if (localPlan === "free") {
      const currentDbPlan = userResult.rows[0].plan || "FREE";
      if (currentDbPlan !== "FREE") {
        localPlan = currentDbPlan.toLowerCase();
      } else {
        localPlan = "pro"; // Default to pro if active subscription but unresolved
      }
    }
  } else if (status === "incomplete") {
    const currentDbPlan = userResult.rows[0].plan || "FREE";
    localPlan = currentDbPlan.toLowerCase();
  } else {
    localPlan = "free";
  }

  const subscriptionId = (status === "canceled" || status === "incomplete_expired") ? null : subscription.id;

  // Synchronize database local plan limits using transaction
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET stripe_subscription_id = $1, plan = $2 WHERE id = $3`,
      [subscriptionId, localPlan.toUpperCase(), userId]
    );
    await billingService.updatePlanByUserId(userId, localPlan.toLowerCase(), client);
    await client.query("COMMIT");
    console.log(`[webhook] Subscription ${subscription.id} status updated to ${status} for user ${userId}. Plan set to ${localPlan.toUpperCase()}.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Failed to update subscription status for user ${userId} in transaction:`, err.message);
  } finally {
    client.release();
  }
};

/**
 * Handle customer.subscription.deleted event — downgrade to free.
 */
const handleSubscriptionDeleted = async (subscription) => {
  const customerId = subscription.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET stripe_subscription_id = NULL, plan = 'FREE' WHERE id = $1`,
      [userId]
    );
    await billingService.updatePlanByUserId(userId, "free", client);
    await client.query("COMMIT");
    console.log(`[webhook] Subscription ${subscription.id} deleted for user ${userId}. Downgraded to free.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Failed to delete subscription for user ${userId} in transaction:`, err.message);
  } finally {
    client.release();
  }
};

/**
 * Handle checkout.session.completed event for subscription checkouts.
 */
const handleSubscriptionCheckoutCompleted = async (session) => {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId || !plan || !customerId || !subscriptionId) {
    console.log(`[webhook] Subscription checkout.session.completed missing metadata. session: ${session.id}`);
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    if (session.payment_status === "paid") {
      // Update user's stripe customer and subscription IDs and plan name
      await client.query(
        `UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2, plan = $3 WHERE id = $4`,
        [customerId, subscriptionId, plan.toUpperCase(), parseInt(userId, 10)]
      );

      // Synchronize database usage limits for the new plan
      await billingService.updatePlanByUserId(parseInt(userId, 10), plan.toLowerCase(), client);

      // Create invoice immediately if payment is paid
      if (session.invoice) {
        try {
          const invoice = await stripe.invoices.retrieve(session.invoice);
          await userBillingService.upsertInvoice(invoice, "Paid", client);
        } catch (invErr) {
          console.error("[webhook] Failed to retrieve/upsert invoice on subscription checkout completion inside transaction:", invErr.message);
        }
      }
      console.log(`[webhook] Subscription checkout completed & verified for user ${userId}, plan ${plan}, sub ${subscriptionId}`);
    } else {
      // If payment not complete, just sync stripe IDs without updating plan limits yet
      await client.query(
        `UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3`,
        [customerId, subscriptionId, parseInt(userId, 10)]
      );
      console.log(`[webhook] Subscription checkout completed but payment is pending for user ${userId}, stripe IDs synchronized.`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Failed to update subscription checkout for user ${userId} in transaction:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Handle checkout.session.completed event.
 * Routes to either ticket order or subscription handler based on session metadata.
 */
const handleCheckoutSessionCompleted = async (session) => {
  const sessionId = session.id;
  const paymentIntentId = session.payment_intent;

  console.log(`[webhook] Processing checkout.session.completed for session ${sessionId}`);

  // Check if this is a subscription checkout using explicit checkoutType metadata
  if (session.metadata?.checkoutType === "subscription") {
    await handleSubscriptionCheckoutCompleted(session);
    return;
  }

  // Also handle legacy sessions that might not have checkoutType but are in subscription mode
  if (session.mode === "subscription") {
    await handleSubscriptionCheckoutCompleted(session);
    return;
  }

  // Find the pending ticket order
  const order = await prisma.ticketOrder.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (!order) {
    console.log(`[webhook] No matching TicketOrder found for session ${sessionId}.`);
    return;
  }

  if (order.status === "PAID") {
    console.log(`[webhook] TicketOrder ${order.id} is already PAID. Skipping duplicate processing.`);
    return;
  }

  // Update order status to PAID
  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paymentIntentId: paymentIntentId,
      paidAt: new Date(),
    },
  });

  console.log(`[webhook] TicketOrder ${order.id} successfully updated to PAID.`);
};

module.exports = {
  handleWebhook,
};
