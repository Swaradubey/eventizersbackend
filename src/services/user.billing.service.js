const db = require("../config/db");
const stripe = require("../config/stripe");

/**
 * Get or create a Stripe customer for the given user.
 * @param {number} userId
 * @returns {string} Stripe customer ID
 */
const getOrCreateStripeCustomer = async (userId) => {
  // Check if user already has a stripe_customer_id
  const userResult = await db.query(
    `SELECT id, name, email, stripe_customer_id FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found.");
  }

  const user = userResult.rows[0];

  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create a new Stripe customer
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: String(userId) },
  });

  // Save the stripe_customer_id to the users table
  await db.query(
    `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
    [customer.id, userId]
  );

  return customer.id;
};

/**
 * Get default payment method for user from Stripe.
 * Falls back to local DB if Stripe is not configured.
 * @param {number} userId
 */
const getPaymentMethod = async (userId) => {
  // If Stripe is configured, fetch from Stripe
  if (stripe) {
    try {
      const customerId = await getOrCreateStripeCustomer(userId);
      const customer = await stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        // Customer was deleted on Stripe — clear local reference
        await db.query(
          `UPDATE users SET stripe_customer_id = NULL WHERE id = $1`,
          [userId]
        );
        return null;
      }

      const defaultPmId = customer.invoice_settings?.default_payment_method;

      if (!defaultPmId) {
        // No default payment method on Stripe — check local DB as fallback
        return await getLocalPaymentMethod(userId);
      }

      // Fetch payment method details from Stripe
      const pm = await stripe.paymentMethods.retrieve(defaultPmId);

      // Sync to local DB
      await syncPaymentMethodToDb(userId, pm, true);

      return {
        cardBrand: capitalizeFirst(pm.card?.brand || "Card"),
        last4: pm.card?.last4 || "0000",
        expiryMonth: String(pm.card?.exp_month || "00").padStart(2, "0"),
        expiryYear: String(pm.card?.exp_year || "0000"),
        status: "Active",
      };
    } catch (err) {
      console.error("[billing] Stripe getPaymentMethod error:", err.message);
      // Fall back to local DB
      return await getLocalPaymentMethod(userId);
    }
  }

  // Stripe not configured — use local DB only
  return await getLocalPaymentMethod(userId);
};

/**
 * Get payment method from local database only.
 * @param {number} userId
 */
const getLocalPaymentMethod = async (userId) => {
  const result = await db.query(
    `SELECT brand, last4, expiry_month, expiry_year, is_default, stripe_payment_method_id 
     FROM payment_methods 
     WHERE user_id = $1 AND is_default = TRUE 
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    return {
      cardBrand: row.brand,
      last4: row.last4,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      status: "Active",
    };
  }

  return null;
};

/**
 * Create a Stripe SetupIntent so the frontend can collect card details.
 * @param {number} userId
 * @returns {{ clientSecret: string }}
 */
const createSetupIntent = async (userId) => {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });

  return { clientSecret: setupIntent.client_secret };
};

/**
 * Attach a new payment method from Stripe and set it as the default.
 * Detaches the previous default if any.
 * @param {number} userId
 * @param {string} paymentMethodId - Stripe payment method ID (pm_xxx)
 */
const updatePaymentMethod = async (userId, paymentMethodId) => {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  // Get current default PM to detach later
  const customer = await stripe.customers.retrieve(customerId);
  const previousDefaultPmId = customer.deleted
    ? null
    : customer.invoice_settings?.default_payment_method;

  // Attach the new payment method to the customer
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  } catch (err) {
    // If already attached to this customer, that's fine
    if (err.code !== "resource_already_exists") {
      throw err;
    }
  }

  // Set as default payment method
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Detach the previous default if it's different from the new one
  if (previousDefaultPmId && previousDefaultPmId !== paymentMethodId) {
    try {
      await stripe.paymentMethods.detach(previousDefaultPmId);
    } catch (err) {
      console.warn("[billing] Failed to detach previous PM:", err.message);
    }
  }

  // Fetch the new PM details from Stripe
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

  // Update local DB — unset all defaults, then sync the new one
  await db.query(
    `UPDATE payment_methods SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );

  await syncPaymentMethodToDb(userId, pm, true);

  return {
    cardBrand: capitalizeFirst(pm.card?.brand || "Card"),
    last4: pm.card?.last4 || "0000",
    expiryMonth: String(pm.card?.exp_month || "00").padStart(2, "0"),
    expiryYear: String(pm.card?.exp_year || "0000"),
    status: "Active",
  };
};

/**
 * Sync a Stripe PaymentMethod object to the local payment_methods table.
 * @param {number} userId
 * @param {object} pm - Stripe PaymentMethod object
 * @param {boolean} isDefault
 */
const syncPaymentMethodToDb = async (userId, pm, isDefault) => {
  const brand = capitalizeFirst(pm.card?.brand || "Card");
  const last4 = pm.card?.last4 || "0000";
  const expiryMonth = String(pm.card?.exp_month || "00").padStart(2, "0");
  const expiryYear = String(pm.card?.exp_year || "0000");

  // Upsert: insert or update
  const existing = await db.query(
    `SELECT id FROM payment_methods WHERE stripe_payment_method_id = $1`,
    [pm.id]
  );

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE payment_methods 
       SET brand = $1, last4 = $2, expiry_month = $3, expiry_year = $4, is_default = $5, updated_at = NOW()
       WHERE stripe_payment_method_id = $6`,
      [brand, last4, expiryMonth, expiryYear, isDefault, pm.id]
    );
  } else {
    await db.query(
      `INSERT INTO payment_methods (id, user_id, stripe_payment_method_id, brand, last4, expiry_month, expiry_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [pm.id, userId, pm.id, brand, last4, expiryMonth, expiryYear, isDefault]
    );
  }
};

/**
 * Get user's invoices from local DB.
 * @param {number} userId
 */
const getInvoices = async (userId) => {
  const result = await db.query(
    `SELECT id, invoice_number, amount, currency, status, invoice_date, pdf_url 
     FROM invoices 
     WHERE user_id = $1 
     ORDER BY invoice_date DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const dateObj = new Date(row.invoice_date);
    const formattedDate = dateObj.toISOString().split("T")[0];
    return {
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      date: formattedDate,
      downloadUrl: row.pdf_url,
    };
  });
};

/**
 * Fetch a single invoice owned by user.
 * @param {number} userId
 * @param {string} invoiceId
 */
const getInvoiceByIdAndUser = async (userId, invoiceId) => {
  const result = await db.query(
    `SELECT * FROM invoices WHERE user_id = $1 AND id = $2 LIMIT 1`,
    [userId, invoiceId]
  );
  return result.rows[0] || null;
};

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 */
const capitalizeFirst = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

module.exports = {
  getOrCreateStripeCustomer,
  getPaymentMethod,
  createSetupIntent,
  updatePaymentMethod,
  getInvoices,
  getInvoiceByIdAndUser,
  syncPaymentMethodToDb,
};
