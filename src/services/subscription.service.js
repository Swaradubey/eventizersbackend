const userBillingService = require("./user.billing.service");
const stripe = require("../config/stripe");
const db = require("../config/db");
const billingService = require("./billing.service");

/**
 * Capitalize first letter of string
 */
const capitalizeFirst = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Handle subscription creation / plan upgrade for a user
 * @param {number} userId
 * @param {string} planId
 */
const subscribeToPlan = async (userId, planId) => {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }

  const validPlans = ["free", "pro", "business", "enterprise"];
  if (!validPlans.includes(planId.toLowerCase())) {
    throw new Error("Invalid plan selection.");
  }

  // Fetch user info
  const userRes = await db.query(
    `SELECT stripe_customer_id, stripe_subscription_id, plan FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0) {
    throw new Error("User not found.");
  }
  const user = userRes.rows[0];

  const plan = planId.toLowerCase();

  // If upgrading/downgrading to Free
  if (plan === "free") {
    // Cancel subscription if exists on Stripe
    if (user.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
      } catch (err) {
        console.warn("[subscription] Error canceling Stripe subscription on free plan switch:", err.message);
      }
    }

    // Sync database local plan/limits
    await db.query(
      `UPDATE users SET stripe_subscription_id = NULL WHERE id = $1`,
      [userId]
    );
    const updated = await billingService.updatePlanByUserId(userId, "free");
    return { success: true, currentPlan: "free", usage: updated.usage };
  }

  // Get pricing details
  let price = 0;
  if (plan === "pro") price = 19;
  else if (plan === "business") price = 49;
  else if (plan === "enterprise") {
    throw new Error("Enterprise plan requires contacting sales.");
  }

  const customerId = await userBillingService.getOrCreateStripeCustomer(userId);

  // Retrieve customer to check for default payment method
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    throw new Error("Stripe customer was deleted.");
  }

  const defaultPmId = customer.invoice_settings?.default_payment_method;

  if (!defaultPmId) {
    // Generate a SetupIntent clientSecret for the frontend to collect payment info
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    return {
      requiresPaymentMethod: true,
      clientSecret: setupIntent.client_secret,
    };
  }

  // If there's an existing Stripe subscription, cancel it first to avoid duplicate billing
  if (user.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(user.stripe_subscription_id);
    } catch (err) {
      console.warn("[subscription] Error canceling old subscription before new one:", err.message);
    }
  }

  // Create Stripe Subscription using inline price_data
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `${capitalizeFirst(plan)} Plan Subscription`,
        },
        unit_amount: price * 100, // Price in cents
        recurring: {
          interval: "month",
        },
      },
    }],
    default_payment_method: defaultPmId,
    metadata: { planId: plan },
    expand: ["latest_invoice.payment_intent"],
  });

  // Save subscription ID to local database
  await db.query(
    `UPDATE users SET stripe_subscription_id = $1 WHERE id = $2`,
    [subscription.id, userId]
  );

  // Update local plan & limits
  const updated = await billingService.updatePlanByUserId(userId, plan);

  return {
    success: true,
    currentPlan: plan,
    subscriptionId: subscription.id,
    usage: updated.usage,
  };
};

module.exports = {
  subscribeToPlan,
};
