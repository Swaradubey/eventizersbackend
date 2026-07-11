const db = require("../config/db");
const crypto = require("crypto");
const { getBillingCycleStart } = require("../utils/billing.helper");

/**
 * Get dynamic usage statistics for a user
 * @param {number} userId
 * @param {Object} [client=db]
 * @returns {Promise<Object>} Usage metrics { eventsCreated, eventsLimit, guestsUsed, guestsLimit, messagesSent, messagesLimit }
 */
const getBillingUsageByUserId = async (userId, client = db) => {
  // 1. Fetch user's plan
  const userResult = await client.query(
    `SELECT plan FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const rawPlan = userResult.rows[0].plan || "FREE";
  const currentPlan = rawPlan.toLowerCase();

  // 2. Fetch subscription usage limits and start date
  const usageResult = await client.query(
    `SELECT "eventsLimit", "guestsLimit", "messagesLimit", month
     FROM "SubscriptionUsage"
     WHERE user_id = $1`,
     [userId]
  );

  let eventsLimit = 10;
  let guestsLimit = 25;
  let messagesLimit = 100;
  let month = new Date();

  if (usageResult.rows.length === 0) {
    // Insert initial safe defaults if no usage record exists
    const id = crypto.randomUUID();
    const now = new Date();
    
    // Determine limits based on current plan
    if (currentPlan === "pro") {
      guestsLimit = 250;
      messagesLimit = 5000;
      eventsLimit = -1;
    } else if (currentPlan === "business" || currentPlan === "enterprise") {
      guestsLimit = -1;
      messagesLimit = -1;
      eventsLimit = -1;
    }

    const insertResult = await client.query(
      `INSERT INTO "SubscriptionUsage" (
         id, user_id, "eventsCreated", "guestsThisMonth", "messagesSent", 
         "eventsLimit", "guestsLimit", "messagesLimit", month, "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, userId, 0, 0, 0, eventsLimit, guestsLimit, messagesLimit, now, now]
    );
    
    const usage = insertResult.rows[0];
    eventsLimit = usage.eventsLimit;
    guestsLimit = usage.guestsLimit;
    messagesLimit = usage.messagesLimit;
    month = usage.month;
  } else {
    const usage = usageResult.rows[0];
    eventsLimit = usage.eventsLimit;
    guestsLimit = usage.guestsLimit;
    messagesLimit = usage.messagesLimit;
    month = usage.month;
  }

  // Calculate billing cycle start dynamically using the shared helper
  const billingCycleStart = await getBillingCycleStart(userId, client);

  // 3. Count actual events created
  const eventsCountResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE created_by = $1`,
    [userId]
  );
  const eventsCreated = eventsCountResult.rows[0].count;

  // 4. Count actual guests this billing month
  const guestsCountResult = await client.query(
    `SELECT COUNT(g.id)::int AS count
     FROM guests g
     JOIN events e ON g.event_id = e.id
     WHERE e.created_by = $1 AND g.created_at >= $2`,
     [userId, billingCycleStart]
  );
  const guestsUsed = guestsCountResult.rows[0].count;

  // 5. Count actual messages sent (status = SENT)
  const messagesCountResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM messages
     WHERE sender_id = $1 AND status = 'SENT'`,
    [userId]
  );
  const messagesSent = messagesCountResult.rows[0].count;

  // Update SubscriptionUsage cache/table values to keep database synchronized
  await client.query(
    `UPDATE "SubscriptionUsage"
     SET "eventsCreated" = $1, "guestsThisMonth" = $2, "messagesSent" = $3, "updatedAt" = NOW()
     WHERE user_id = $4`,
    [eventsCreated, guestsUsed, messagesSent, userId]
  );

  return {
    eventsCreated,
    eventsLimit,
    guestsUsed,
    guestsLimit,
    messagesSent,
    messagesLimit,
  };
};

/**
 * Get billing details and usage metrics for a user
 * @param {number} userId
 * @param {Object} [client=db]
 * @returns {Promise<Object>} { usage, currentPlan }
 */
const getBillingByUserId = async (userId, client = db) => {
  // 1. Fetch user's plan
  const userResult = await client.query(
    `SELECT plan FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const rawPlan = userResult.rows[0].plan || "FREE";
  const currentPlan = rawPlan.toLowerCase();

  // Get dynamic usage stats
  const dynamicUsage = await getBillingUsageByUserId(userId, client);

  return {
    currentPlan,
    usage: {
      eventsCreated: dynamicUsage.eventsCreated,
      eventsLimit: dynamicUsage.eventsLimit,
      guestsUsed: dynamicUsage.guestsUsed,
      guestsLimit: dynamicUsage.guestsLimit,
      messagesUsed: dynamicUsage.messagesSent,
      messagesLimit: dynamicUsage.messagesLimit,
    }
  };
};

/**
 * Update plan and limits for a user
 * @param {number} userId
 * @param {string} planId
 * @param {Object} [client=db]
 * @returns {Promise<Object>} { usage, currentPlan }
 */
const updatePlanByUserId = async (userId, planId, client = db) => {
  const planUpper = planId.toUpperCase();
  
  // 1. Update users plan
  const userUpdate = await client.query(
    `UPDATE users SET plan = $1 WHERE id = $2 RETURNING plan`,
    [planUpper, userId]
  );

  if (userUpdate.rows.length === 0) {
    throw new Error("User not found");
  }

  // Determine limits based on target plan
  let guestsLimit = 25;
  let messagesLimit = 100;
  let eventsLimit = 10;
  
  if (planId === "pro") {
    guestsLimit = 250;
    messagesLimit = 5000;
    eventsLimit = -1;
  } else if (planId === "business" || planId === "enterprise") {
    guestsLimit = -1;
    messagesLimit = -1;
    eventsLimit = -1;
  }

  // 2. Check and update or insert SubscriptionUsage
  const usageCheck = await client.query(
    `SELECT id FROM "SubscriptionUsage" WHERE user_id = $1`,
    [userId]
  );

  const now = new Date();
  if (usageCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO "SubscriptionUsage" (
         id, user_id, "eventsCreated", "guestsThisMonth", "messagesSent", 
         "eventsLimit", "guestsLimit", "messagesLimit", month, "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, 0, 0, 0, eventsLimit, guestsLimit, messagesLimit, now, now]
    );
  } else {
    await client.query(
      `UPDATE "SubscriptionUsage"
       SET "guestsLimit" = $1, "messagesLimit" = $2, "eventsLimit" = $3, "updatedAt" = $4
       WHERE user_id = $5`,
      [guestsLimit, messagesLimit, eventsLimit, now, userId]
    );
  }

  // Get updated dynamic usage stats
  const dynamicUsage = await getBillingUsageByUserId(userId, client);

  return {
    currentPlan: planId,
    usage: {
      eventsCreated: dynamicUsage.eventsCreated,
      eventsLimit: dynamicUsage.eventsLimit,
      guestsUsed: dynamicUsage.guestsUsed,
      guestsLimit: dynamicUsage.guestsLimit,
      messagesUsed: dynamicUsage.messagesSent,
      messagesLimit: dynamicUsage.messagesLimit,
    }
  };
};

module.exports = {
  getBillingByUserId,
  updatePlanByUserId,
  getBillingUsageByUserId,
};

