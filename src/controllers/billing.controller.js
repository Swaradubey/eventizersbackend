const stripe = require("../config/stripe");
const db = require("../config/db");
const prisma = require("../config/prisma");
const userBillingService = require("../services/user.billing.service");
const billingService = require("../services/billing.service");
const { normalizePlanId, PAID_PLAN_IDS, getStripePriceId } = require("../config/plans.config");

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe subscription checkout session for Host or Pro plans.
 */
const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe billing is not configured. STRIPE_SECRET_KEY is missing." });
    }

    const { plan } = req.body;

    if (!plan || typeof plan !== "string") {
      return res.status(400).json({ error: "Invalid subscription plan. Plan is required." });
    }

    const normalizedPlan = plan.toLowerCase().trim();
    // Only allow paid plans (pro, business) — not free, host, or arbitrary values
    if (!PAID_PLAN_IDS.includes(normalizedPlan)) {
      return res.status(400).json({ error: "Only 'pro' and 'business' subscription plans are supported for Stripe Checkout." });
    }

    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: "User authentication required." });
    }

    // Fetch current user from database to verify existing subscription state
    const userResult = await db.query(
      `SELECT id, plan, subscription_status, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1`,
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const dbUser = userResult.rows[0];
    const currentDbPlan = normalizePlanId(dbUser.plan || "FREE");
    const currentSubStatus = (dbUser.subscription_status || "active").toLowerCase();

    // Check if user already has the requested plan active
    if (currentDbPlan === normalizedPlan && (currentSubStatus === "active" || currentSubStatus === "trialing")) {
      return res.status(400).json({
        error: "This plan is already active on your account.",
        alreadyActive: true,
      });
    }

    // Check if user already has another active paid subscription
    if (
      PAID_PLAN_IDS.includes(currentDbPlan) &&
      currentDbPlan !== normalizedPlan &&
      (currentSubStatus === "active" || currentSubStatus === "trialing")
    ) {
      return res.status(400).json({
        error: "You already have an active paid subscription. Please manage or cancel your existing subscription in billing settings.",
        hasExistingSubscription: true,
      });
    }

    // Resolve Stripe price ID from backend config (never trust frontend)
    const priceId = getStripePriceId(normalizedPlan);

    if (!priceId) {
      console.error(`[billing] STRIPE_${normalizedPlan.toUpperCase()}_PRICE_ID is missing or not configured.`);
      return res.status(503).json({ error: `Stripe price for plan '${normalizedPlan}' is not configured.` });
    }

    // Get or create Stripe Customer
    const customerId = await userBillingService.getOrCreateStripeCustomer(user.id);

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=cancelled#pricing`,
      client_reference_id: String(user.id),
      metadata: {
        userId: String(user.id),
        plan: normalizedPlan,
        checkoutType: "subscription",
      },
      subscription_data: {
        metadata: {
          userId: String(user.id),
          plan: normalizedPlan,
          checkoutType: "subscription",
        },
      },
    });

    if (!session || !session.url) {
      console.error("[billing] Stripe Checkout session created without URL.");
      return res.status(500).json({ error: "Failed to generate Stripe Checkout URL." });
    }

    return res.status(200).json({
      checkoutUrl: session.url,
      url: session.url,
    });
  } catch (error) {
    console.error("[billing] createCheckoutSession error:", error);
    return res.status(500).json({ error: "Unable to create Stripe checkout session." });
  }
};

/**
 * POST /api/billing/activate-free
 * Activate the Free plan directly for an authenticated user.
 */
const activateFreePlan = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: "User authentication required." });
    }

    const userResult = await db.query(
      `SELECT id, plan, subscription_status FROM users WHERE id = $1`,
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const dbUser = userResult.rows[0];
    const currentDbPlan = (dbUser.plan || "FREE").toLowerCase();
    const currentSubStatus = (dbUser.subscription_status || "ACTIVE").toLowerCase();

    // Prevent duplicate activation if already active on free plan
    if (currentDbPlan === "free" && currentSubStatus === "active") {
      return res.status(200).json({
        success: true,
        message: "Free plan is already active on your account.",
        alreadyActive: true,
      });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users 
         SET plan = 'FREE', 
             subscription_status = 'active', 
             stripe_subscription_id = NULL,
             plan_start_date = NOW()
         WHERE id = $1`,
        [user.id]
      );

      await billingService.updatePlanByUserId(user.id, "free", client);
      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Free plan activated successfully.",
        plan: "free",
        subscriptionStatus: "active",
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      console.error("[billing] Error updating free plan in transaction:", txErr);
      return res.status(500).json({ error: "Failed to activate Free plan in database." });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[billing] activateFreePlan error:", error);
    return res.status(500).json({ error: "Unable to activate Free plan." });
  }
};

/**
 * GET /api/billing/verify-session/:sessionId
 * Verify a Stripe Checkout Session status for the Payment Success page.
 */
const verifyCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe billing is not configured." });
    }

    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Session ID parameter is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Checkout session not found." });
    }

    // Ensure session belongs to the logged-in user
    const sessionUserId = session.client_reference_id || session.metadata?.userId;
    if (!sessionUserId || String(sessionUserId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Checkout session does not belong to the current user." });
    }

    let subscriptionStatus = null;
    let currentPeriodEnd = null;

    if (session.subscription) {
      try {
        const subscription = typeof session.subscription === "string" 
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;
        subscriptionStatus = subscription.status;
        if (subscription.current_period_end) {
          currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        }
      } catch (err) {
        console.error("[billing] Error fetching subscription details:", err.message);
      }
    }

    const plan = session.metadata?.plan || "free";
    const isSuccess = session.payment_status === "paid" || subscriptionStatus === "active" || subscriptionStatus === "trialing";

    // Proactively sync database if payment is verified and DB plan is not updated yet
    if (isSuccess) {
      const userResult = await db.query(
        `SELECT plan FROM users WHERE id = $1`,
        [req.user.id]
      );
      const currentDbPlan = userResult.rows[0]?.plan?.toLowerCase();

      if (currentDbPlan !== plan.toLowerCase()) {
        const client = await db.pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE users 
             SET plan = $1, 
                 subscription_status = 'active',
                 stripe_customer_id = $2, 
                 stripe_subscription_id = $3,
                 plan_expiry_date = $4
             WHERE id = $5`,
            [
              plan.toUpperCase(),
              session.customer,
              session.subscription,
              currentPeriodEnd ? new Date(currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              req.user.id,
            ]
          );
          await billingService.updatePlanByUserId(req.user.id, plan.toLowerCase(), client);
          await client.query("COMMIT");
          console.log(`[billing] Proactively verified and updated user ${req.user.id} to plan ${plan.toUpperCase()}`);
        } catch (txErr) {
          await client.query("ROLLBACK");
          console.error("[billing] Proactive sync error:", txErr.message);
        } finally {
          client.release();
        }
      }
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).json({
      success: isSuccess,
      status: session.status,
      paymentStatus: session.payment_status,
      plan: plan,
      subscriptionStatus: subscriptionStatus || (session.payment_status === "paid" ? "active" : "pending"),
      currentPeriodEnd,
    });
  } catch (error) {
    console.error("[billing] verifyCheckoutSession error:", error);
    return res.status(500).json({ error: "Unable to verify checkout session." });
  }
};

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook notifications with raw body verification.
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
    console.error("[webhook] Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  console.log(`[webhook] Received valid Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[webhook] Event type ${event.type} received, no handler needed.`);
    }
  } catch (err) {
    console.error(`[webhook] Error processing event ${event.type}:`, err.message);
  }

  return res.status(200).json({ received: true });
};

/**
 * Handle checkout.session.completed event
 */
const handleCheckoutSessionCompleted = async (session) => {
  const userId = session.metadata?.userId || session.client_reference_id;
  const plan = session.metadata?.plan;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId || !plan) {
    console.log(`[webhook] checkout.session.completed missing userId or plan metadata for session ${session.id}`);
    return;
  }

  const numericUserId = parseInt(userId, 10);
  if (isNaN(numericUserId)) {
    console.error(`[webhook] Invalid numeric userId: ${userId}`);
    return;
  }

  let currentPeriodEnd = null;
  if (subscriptionId && stripe) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.current_period_end) {
        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      }
    } catch (err) {
      console.error(`[webhook] Error fetching subscription ${subscriptionId}:`, err.message);
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const status = session.payment_status === "paid" ? "active" : "pending";
    await client.query(
      `UPDATE users 
       SET plan = $1, 
           subscription_status = $2, 
           stripe_customer_id = $3, 
           stripe_subscription_id = $4,
           plan_expiry_date = COALESCE($5, plan_expiry_date)
       WHERE id = $6`,
      [plan.toUpperCase(), status, customerId, subscriptionId, currentPeriodEnd, numericUserId]
    );

    await billingService.updatePlanByUserId(numericUserId, plan.toLowerCase(), client);
    await client.query("COMMIT");
    console.log(`[webhook] Successfully updated user ${numericUserId} to plan ${plan.toUpperCase()} on checkout.session.completed.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Error updating user ${numericUserId} in checkout completion transaction:`, err.message);
  } finally {
    client.release();
  }
};

/**
 * Handle customer.subscription.created and customer.subscription.updated events
 */
const handleSubscriptionUpdated = async (subscription) => {
  const customerId = subscription.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id, plan FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  const stripeStatus = subscription.status;
  const planFromMeta = subscription.metadata?.plan;

  let planId = planFromMeta || null;
  if (!planId && subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId === process.env.STRIPE_PRO_PRICE_ID?.trim()) {
      planId = "pro";
    } else if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID?.trim()) {
      planId = "business";
    }
  }

  let localPlan = planId ? normalizePlanId(planId) : normalizePlanId(userResult.rows[0].plan || "free");
  let currentPeriodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000) 
    : null;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users 
       SET subscription_status = $1, 
           plan = $2, 
           stripe_subscription_id = $3,
           plan_expiry_date = COALESCE($4, plan_expiry_date)
       WHERE id = $5`,
      [stripeStatus, localPlan.toUpperCase(), subscription.id, currentPeriodEnd, userId]
    );

    await billingService.updatePlanByUserId(userId, localPlan.toLowerCase(), client);
    await client.query("COMMIT");
    console.log(`[webhook] Subscription updated to ${stripeStatus} for user ${userId}, plan ${localPlan.toUpperCase()}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Subscription update transaction failed for user ${userId}:`, err.message);
  } finally {
    client.release();
  }
};

/**
 * Handle customer.subscription.deleted event — downgrade user to Free plan
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
      `UPDATE users 
       SET plan = 'FREE', 
           subscription_status = 'active', 
           stripe_subscription_id = NULL 
       WHERE id = $1`,
      [userId]
    );

    await billingService.updatePlanByUserId(userId, "free", client);
    await client.query("COMMIT");
    console.log(`[webhook] Subscription deleted for user ${userId}. Downgraded to Free plan.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[webhook] Subscription deletion transaction failed for user ${userId}:`, err.message);
  } finally {
    client.release();
  }
};

/**
 * Handle invoice.payment_failed event
 */
const handleInvoicePaymentFailed = async (invoice) => {
  const customerId = invoice.customer;
  if (!customerId) return;

  const userResult = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1`,
    [customerId]
  );

  if (userResult.rows.length === 0) return;

  const userId = userResult.rows[0].id;
  await db.query(
    `UPDATE users SET subscription_status = 'past_due' WHERE id = $1`,
    [userId]
  );
  console.log(`[webhook] Invoice payment failed for user ${userId}. Set subscription_status = 'past_due'`);
};

/**
 * GET /api/dashboard/billing
 * Get current billing info, plan details, and usage metrics for the logged-in user.
 */
const getBillingInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const billingData = await billingService.getBillingByUserId(userId);
    return res.status(200).json({
      success: true,
      ...billingData,
    });
  } catch (error) {
    console.error("[billing] getBillingInfo error:", error);
    return res.status(500).json({ error: "Unable to retrieve billing information." });
  }
};

/**
 * GET /api/dashboard/billing/usage
 * Get current usage metrics for the logged-in user.
 */
const getBillingUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const usage = await billingService.getBillingUsageByUserId(userId);
    return res.status(200).json(usage);
  } catch (error) {
    console.error("[billing] getBillingUsage error:", error);
    return res.status(500).json({ error: "Unable to retrieve billing usage metrics." });
  }
};

/**
 * PATCH /api/dashboard/billing
 * Update the subscription plan for the logged-in user.
 */
const updateBillingInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, planId } = req.body;
    const targetPlan = plan || planId;

    if (!targetPlan || typeof targetPlan !== "string") {
      return res.status(400).json({ error: "Invalid plan specified." });
    }

    const billingData = await billingService.updatePlanByUserId(userId, targetPlan.toLowerCase().trim());
    return res.status(200).json({
      success: true,
      ...billingData,
    });
  } catch (error) {
    console.error("[billing] updateBillingInfo error:", error);
    return res.status(500).json({ error: "Unable to update billing plan." });
  }
};

module.exports = {
  createCheckoutSession,
  activateFreePlan,
  verifyCheckoutSession,
  handleWebhook,
  getBillingInfo,
  getBillingUsage,
  updateBillingInfo,
};

