const stripe = require("../config/stripe");
const db = require("../config/db");
const userBillingService = require("../services/user.billing.service");

const PLAN_CONFIG = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID?.trim(),
    expectedAmount: 1900,
    expectedCurrency: "usd",
    expectedInterval: "month",
  },
  business: {
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID?.trim(),
    expectedAmount: 4900,
    expectedCurrency: "usd",
    expectedInterval: "month",
  },
};

const isPlaceholder = (value) => {
  if (!value) return true;
  const lower = value.toLowerCase();
  return lower.includes("replace_me") || lower.includes("yyyyyy") || lower.includes("xxxxxx");
};

const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe billing is not configured." });
    }

    const { plan } = req.body;

    if (!plan || typeof plan !== "string") {
      return res.status(400).json({ error: "Invalid subscription plan." });
    }

    const normalizedPlan = plan.toLowerCase().trim();
    const config = PLAN_CONFIG[normalizedPlan];

    if (!config) {
      return res.status(400).json({ error: "Invalid subscription plan." });
    }

    const priceId = config.priceId;

    if (isPlaceholder(priceId)) {
      console.error(`[stripe] ${normalizedPlan} Price ID is missing or a placeholder.`);
      return res.status(503).json({ error: "The selected subscription plan is unavailable." });
    }

    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (err) {
      console.error(`[stripe] Failed to retrieve price ${priceId}:`, err.type, err.stripeRequestId);
      return res.status(503).json({ error: "The selected subscription plan is unavailable." });
    }

    if (!price.active ||
        !price.recurring ||
        price.recurring.interval !== config.expectedInterval ||
        price.currency !== config.expectedCurrency ||
        price.unit_amount !== config.expectedAmount) {
      console.error(`[stripe] Price mismatch for ${normalizedPlan}. Expected ${config.expectedAmount} ${config.expectedCurrency}/${config.expectedInterval}, got ${price.unit_amount} ${price.currency}/${price.recurring?.interval}`);
      return res.status(503).json({ error: "The selected Stripe price does not match the configured plan." });
    }

    const authenticatedUser = req.user;
    const customerId = await userBillingService.getOrCreateStripeCustomer(authenticatedUser.id);

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing?checkout=cancelled`,
      client_reference_id: String(authenticatedUser.id),
      customer: customerId,
      metadata: {
        userId: String(authenticatedUser.id),
        plan: normalizedPlan,
        checkoutType: "subscription",
      },
      subscription_data: {
        metadata: {
          userId: String(authenticatedUser.id),
          plan: normalizedPlan,
          checkoutType: "subscription",
        },
      },
    });

    if (!session || !session.url) {
      console.error("[stripe] Checkout Session created but missing url.");
      return res.status(500).json({ error: "Unable to start Stripe Checkout." });
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("[stripe] createCheckoutSession error:", error.type, error.stripeRequestId, "userId:", req.user?.id);
    return res.status(500).json({ error: "Unable to start Stripe Checkout." });
  }
};

const createBillingPortalSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe billing is not configured." });
    }

    const authenticatedUser = req.user;
    const customerId = await userBillingService.getOrCreateStripeCustomer(authenticatedUser.id);

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/dashboard/billing`,
    });

    if (!portalSession || !portalSession.url) {
      console.error("[stripe] Billing Portal Session created but missing url.");
      return res.status(500).json({ error: "Unable to open billing portal." });
    }

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("[stripe] createBillingPortalSession error:", error.type, error.stripeRequestId, "userId:", req.user?.id);
    return res.status(500).json({ error: "Unable to open billing portal." });
  }
};

const getCheckoutSessionStatus = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe billing is not configured." });
    }

    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Invalid session ID." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Checkout session not found." });
    }

    // Verify the session belongs to the authenticated user
    const sessionUserId = session.client_reference_id || session.metadata?.userId;
    if (!sessionUserId || String(sessionUserId) !== String(req.user.id)) {
      return res.status(403).json({ error: "This session does not belong to the current user." });
    }

    if (session.mode !== "subscription") {
      return res.status(400).json({ error: "Session is not a subscription checkout." });
    }

    // Determine subscription status
    let subscriptionStatus = null;
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionStatus = subscription.status;

        // Immediately retrieve and upsert invoice in local database if paid
        if (session.payment_status === "paid" && session.invoice) {
          try {
            const invoice = await stripe.invoices.retrieve(session.invoice);
            await userBillingService.upsertInvoice(invoice, "Paid");
          } catch (invErr) {
            console.error("[stripe] Error retrieving/saving invoice in status check:", invErr.message);
          }
        }
      } catch (err) {
        // Subscription may still be provisioning
      }
    }

    const plan = session.metadata?.plan || null;

    // Verify database synchronization (ensure webhook has finished processing)
    const userResult = await db.query(
      `SELECT plan FROM users WHERE id = $1`,
      [req.user.id]
    );
    const dbPlan = userResult.rows[0]?.plan?.toLowerCase();
    const sessionPlan = plan?.toLowerCase();

    const stripeActive = subscriptionStatus === "active" || subscriptionStatus === "trialing" || subscriptionStatus === "complete";
    if (stripeActive && dbPlan !== sessionPlan) {
      subscriptionStatus = "pending";
    }

    return res.status(200).json({
      status: session.status,
      paymentStatus: session.payment_status,
      plan,
      subscriptionStatus,
    });
  } catch (error) {
    console.error("[stripe] getCheckoutSessionStatus error:", error.type, "sessionId:", req.params?.sessionId);
    return res.status(500).json({ error: "Unable to retrieve checkout session status." });
  }
};

module.exports = {
  createCheckoutSession,
  createBillingPortalSession,
  getCheckoutSessionStatus,
};