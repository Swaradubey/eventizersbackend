const db = require("../config/db");
const billingService = require("../services/billing.service");
const crypto = require("crypto");

/**
 * Get aggregated admin billing dashboard statistics
 * GET /api/admin/billing/stats
 */
const getBillingStats = async (req, res) => {
  try {
    // Total subscribers count
    const totalResult = await db.query(`SELECT COUNT(*)::int AS count FROM users`);
    const totalSubscribers = totalResult.rows[0].count;

    // Free users
    const freeResult = await db.query(`
      SELECT COUNT(*)::int AS count 
      FROM users 
      WHERE plan IS NULL OR UPPER(plan) = 'FREE'
    `);
    const freeUsers = freeResult.rows[0].count;

    // Paid users
    const paidResult = await db.query(`
      SELECT COUNT(*)::int AS count 
      FROM users 
      WHERE plan IS NOT NULL AND UPPER(plan) != 'FREE'
    `);
    const paidUsers = paidResult.rows[0].count;

    // Active subscription status
    const activeResult = await db.query(`
      SELECT COUNT(*)::int AS count 
      FROM users 
      WHERE subscription_status = 'ACTIVE' OR UPPER(subscription_status) = 'ACTIVE'
    `);
    const activeSubscriptions = activeResult.rows[0].count;

    // Expired subscription status
    const expiredResult = await db.query(`
      SELECT COUNT(*)::int AS count 
      FROM users 
      WHERE subscription_status = 'EXPIRED' OR UPPER(subscription_status) = 'EXPIRED'
    `);
    const expiredPlans = expiredResult.rows[0].count;

    // Monthly revenue (estimated: Pro is $19, Business/Enterprise is $49, Starter is $9)
    const revenueResult = await db.query(`
      SELECT plan, COUNT(*)::int AS count
      FROM users
      WHERE plan IS NOT NULL AND UPPER(plan) != 'FREE'
      GROUP BY plan
    `);
    
    let monthlyRevenue = 0;
    revenueResult.rows.forEach((row) => {
      const planName = (row.plan || "").toLowerCase();
      const count = row.count;
      if (planName === "pro") {
        monthlyRevenue += count * 19;
      } else if (planName === "business" || planName === "enterprise") {
        monthlyRevenue += count * 49;
      } else if (planName === "starter") {
        monthlyRevenue += count * 9;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalSubscribers,
        freeUsers,
        paidUsers,
        activeSubscriptions,
        expiredPlans,
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error("Admin Billing Stats Error:", error);
    return res.status(500).json({ error: "Server error retrieving admin billing statistics." });
  }
};

/**
 * Get all users and their billing/usage details
 * GET /api/admin/billing/users
 */
const getBillingUsers = async (req, res) => {
  try {
    // Fetch users with their usage data (including role)
    const queryResult = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role,
        u.plan, 
        u.subscription_status, 
        u.billing_status, 
        u.plan_start_date, 
        u.plan_expiry_date,
        su.id AS usage_id,
        su."eventsCreated",
        su."guestsThisMonth",
        su."messagesSent",
        su."eventsLimit",
        su."guestsLimit",
        su."messagesLimit",
        su."updatedAt"
      FROM users u
      LEFT JOIN "SubscriptionUsage" su ON u.id = su.user_id
      ORDER BY u.created_at DESC
    `);

    const users = [];

    for (const row of queryResult.rows) {
      let usage = {
        eventsCreated: row.eventsCreated !== null && row.eventsCreated !== undefined ? row.eventsCreated : 0,
        eventsLimit: row.eventsLimit !== null && row.eventsLimit !== undefined ? row.eventsLimit : 10,
        guestsUsed: row.guestsThisMonth !== null && row.guestsThisMonth !== undefined ? row.guestsThisMonth : 0,
        guestsLimit: row.guestsLimit !== null && row.guestsLimit !== undefined ? row.guestsLimit : 25,
        messagesUsed: row.messagesSent !== null && row.messagesSent !== undefined ? row.messagesSent : 0,
        messagesLimit: row.messagesLimit !== null && row.messagesLimit !== undefined ? row.messagesLimit : 100,
        updatedAt: row.updatedAt || new Date(),
      };

      const planVal = row.plan || "Free";
      const subVal = row.subscription_status || "Active";
      const billVal = row.billing_status || "Active";
      const startVal = row.plan_start_date || new Date();
      const expiryVal = row.plan_expiry_date || new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);

      // Auto update users table if billing fields are missing
      if (!row.plan || !row.subscription_status || !row.billing_status || !row.plan_start_date || !row.plan_expiry_date) {
        try {
          await db.query(
            `UPDATE users 
             SET plan = $1, subscription_status = $2, billing_status = $3, 
                 plan_start_date = $4, plan_expiry_date = $5 
             WHERE id = $6`,
            [planVal, subVal, billVal, startVal, expiryVal, row.id]
          );
        } catch (dbErr) {
          console.error(`Failed to update default billing values for user ${row.id}:`, dbErr.message);
        }
      }

      // Auto create SubscriptionUsage if missing
      if (!row.usage_id) {
        const userId = row.id;
        const currentPlan = planVal.toLowerCase();
        let eventsLimit = 10;
        let guestsLimit = 25;
        let messagesLimit = 100;
        const now = new Date();

        if (currentPlan === "starter") {
          eventsLimit = 20;
          guestsLimit = 100;
          messagesLimit = 1000;
        } else if (currentPlan === "pro") {
          eventsLimit = -1;
          guestsLimit = 250;
          messagesLimit = 5000;
        } else if (currentPlan === "business" || currentPlan === "enterprise") {
          eventsLimit = -1;
          guestsLimit = -1;
          messagesLimit = -1;
        }

        try {
          const usageId = crypto.randomUUID();
          await db.query(
            `INSERT INTO "SubscriptionUsage" (
               id, user_id, "eventsCreated", "guestsThisMonth", "messagesSent", 
               "eventsLimit", "guestsLimit", "messagesLimit", month, "updatedAt"
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [usageId, userId, 0, 0, 0, eventsLimit, guestsLimit, messagesLimit, now, now]
          );
          
          usage = {
            eventsCreated: 0,
            eventsLimit,
            guestsUsed: 0,
            guestsLimit,
            messagesUsed: 0,
            messagesLimit,
            updatedAt: now,
          };
        } catch (dbErr) {
          console.error(`Failed to seed default usage for user ${userId}:`, dbErr.message);
        }
      }

      users.push({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || "USER",
        plan: planVal,
        subscriptionStatus: subVal,
        billingStatus: billVal,
        planStartDate: startVal,
        planExpiryDate: expiryVal,
        usage,
      });
    }

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Admin Get Billing Users Error:", error);
    return res.status(200).json({
      success: true,
      users: [],
      error: "Server error retrieving admin billing users list."
    });
  }
};

/**
 * Assign a subscription plan to a user
 * PATCH /api/admin/billing/users/:userId/plan
 */
const updateUserPlan = async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan is required." });
    }

    const planLower = plan.toLowerCase();
    const validPlans = ["free", "starter", "pro", "business", "enterprise"];
    if (!validPlans.includes(planLower)) {
      return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
    }

    // Update plan and limits using billingService logic
    // Note: billingService.updatePlanByUserId supports pro, business, enterprise, and free.
    // Let's check: if starter, we will update it directly or via custom code
    if (planLower === "starter") {
      // Direct SQL for starter plan
      await db.query(`UPDATE users SET plan = $1 WHERE id = $2`, ["STARTER", userId]);
      
      const usageCheck = await db.query(
        `SELECT id FROM "SubscriptionUsage" WHERE user_id = $1`,
        [userId]
      );

      const now = new Date();
      const guestsLimit = 100;
      const messagesLimit = 1000;
      const eventsLimit = 20;

      if (usageCheck.rows.length === 0) {
        const id = crypto.randomUUID();
        await db.query(
          `INSERT INTO "SubscriptionUsage" (
             id, user_id, "eventsCreated", "guestsThisMonth", "messagesSent", 
             "eventsLimit", "guestsLimit", "messagesLimit", month, "updatedAt"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, userId, 0, 0, 0, eventsLimit, guestsLimit, messagesLimit, now, now]
        );
      } else {
        await db.query(
          `UPDATE "SubscriptionUsage"
           SET "guestsLimit" = $1, "messagesLimit" = $2, "eventsLimit" = $3, "updatedAt" = $4
           WHERE user_id = $5`,
          [guestsLimit, messagesLimit, eventsLimit, now, userId]
        );
      }
    } else {
      await billingService.updatePlanByUserId(userId, planLower);
    }

    // Refresh start/expiry dates upon plan change
    await db.query(`
      UPDATE users 
      SET plan_start_date = CURRENT_TIMESTAMP,
          plan_expiry_date = (CURRENT_TIMESTAMP + INTERVAL '30 days')
      WHERE id = $1
    `, [userId]);

    return res.status(200).json({
      success: true,
      message: `User plan successfully updated to ${plan.toUpperCase()}`,
    });
  } catch (error) {
    console.error("Admin Update User Plan Error:", error);
    return res.status(500).json({ error: "Server error updating user plan." });
  }
};

/**
 * Reset specific user billing usage metrics
 * POST /api/admin/billing/users/:userId/reset-usage
 */
const resetUsage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.body; // 'events', 'guests', 'messages', or 'all'

    if (!type) {
      return res.status(400).json({ error: "Reset type is required. Must be 'events', 'guests', 'messages' or 'all'." });
    }

    let usageCheck = await db.query(
      `SELECT id FROM "SubscriptionUsage" WHERE user_id = $1`,
      [userId]
    );

    if (usageCheck.rows.length === 0) {
      try {
        const usageId = crypto.randomUUID();
        const now = new Date();
        await db.query(
          `INSERT INTO "SubscriptionUsage" (
             id, user_id, "eventsCreated", "guestsThisMonth", "messagesSent", 
             "eventsLimit", "guestsLimit", "messagesLimit", month, "updatedAt"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [usageId, userId, 0, 0, 0, 10, 25, 100, now, now]
        );
      } catch (dbErr) {
        console.error(`Failed to seed default usage during reset for user ${userId}:`, dbErr.message);
      }
    }

    const now = new Date();
    if (type === "events") {
      await db.query(
        `UPDATE "SubscriptionUsage" SET "eventsCreated" = 0, "updatedAt" = $1 WHERE user_id = $2`,
        [now, userId]
      );
    } else if (type === "guests") {
      await db.query(
        `UPDATE "SubscriptionUsage" SET "guestsThisMonth" = 0, "updatedAt" = $1 WHERE user_id = $2`,
        [now, userId]
      );
    } else if (type === "messages") {
      await db.query(
        `UPDATE "SubscriptionUsage" SET "messagesSent" = 0, "updatedAt" = $1 WHERE user_id = $2`,
        [now, userId]
      );
    } else if (type === "all") {
      await db.query(
        `UPDATE "SubscriptionUsage" 
         SET "eventsCreated" = 0, "guestsThisMonth" = 0, "messagesSent" = 0, "updatedAt" = $1 
         WHERE user_id = $2`,
        [now, userId]
      );
    } else {
      return res.status(400).json({ error: "Invalid reset type. Must be 'events', 'guests', 'messages' or 'all'." });
    }

    return res.status(200).json({
      success: true,
      message: `Usage metrics for '${type}' successfully reset.`,
    });
  } catch (error) {
    console.error("Admin Reset Usage Error:", error);
    return res.status(500).json({ error: "Server error resetting user usage." });
  }
};

/**
 * Update user subscription status (ACTIVE, SUSPENDED, EXPIRED)
 * PATCH /api/admin/billing/users/:userId/subscription-status
 */
const updateSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Subscription status is required." });
    }

    const statusUpper = status.toUpperCase();
    const validStatuses = ["ACTIVE", "SUSPENDED", "EXPIRED"];
    if (!validStatuses.includes(statusUpper)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    await db.query(
      `UPDATE users SET subscription_status = $1 WHERE id = $2`,
      [statusUpper, userId]
    );

    return res.status(200).json({
      success: true,
      message: `Subscription status successfully updated to ${statusUpper}`,
    });
  } catch (error) {
    console.error("Admin Update Subscription Status Error:", error);
    return res.status(500).json({ error: "Server error updating subscription status." });
  }
};

/**
 * Update user billing status (PAID, UNPAID, PENDING)
 * PATCH /api/admin/billing/users/:userId/billing-status
 */
const updateBillingStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Billing status is required." });
    }

    const statusUpper = status.toUpperCase();
    const validStatuses = ["PAID", "UNPAID", "PENDING"];
    if (!validStatuses.includes(statusUpper)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    await db.query(
      `UPDATE users SET billing_status = $1 WHERE id = $2`,
      [statusUpper, userId]
    );

    return res.status(200).json({
      success: true,
      message: `Billing status successfully updated to ${statusUpper}`,
    });
  } catch (error) {
    console.error("Admin Update Billing Status Error:", error);
    return res.status(500).json({ error: "Server error updating billing status." });
  }
};

/**
 * Delete a user and all their related data safely.
 * DELETE /api/admin/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const userIdToDelete = Number(req.params.id);
    const adminUserId = req.user.id;

    if (!userIdToDelete) {
      return res.status(400).json({ error: "User ID is required." });
    }

    // 1. Protection: Do NOT allow deleting the currently logged-in Admin account
    if (userIdToDelete === adminUserId) {
      return res.status(400).json({ error: "You cannot delete your own admin account." });
    }

    // Check if the user exists
    const userCheck = await db.query("SELECT id, role, email FROM users WHERE id = $1", [userIdToDelete]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const targetUser = userCheck.rows[0];

    // 2. Protection: Do NOT allow deleting the last remaining Admin account
    if (targetUser.role === "ADMIN") {
      const adminCountRes = await db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'ADMIN'");
      const adminCount = adminCountRes.rows[0].count;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last remaining Admin account." });
      }
    }

    // 3. Delete Operation using SQL Transaction
    await db.query("BEGIN");

    // a. Delete ticket order items belonging to ticket orders of events created by the user
    await db.query(`
      DELETE FROM ticket_order_items 
      WHERE order_id IN (
        SELECT id FROM ticket_orders 
        WHERE event_id IN (
          SELECT id FROM events WHERE created_by = $1
        )
      )
    `, [userIdToDelete]);

    // b. Delete ticket orders of events created by the user
    await db.query(`
      DELETE FROM ticket_orders 
      WHERE event_id IN (
        SELECT id FROM events WHERE created_by = $1
      )
    `, [userIdToDelete]);

    // c. Delete explicitly linked user tables to avoid potential lock issues
    await db.query(`DELETE FROM "Invoice" WHERE user_id = $1`, [userIdToDelete]);
    await db.query(`DELETE FROM "PaymentMethod" WHERE user_id = $1`, [userIdToDelete]);
    await db.query(`DELETE FROM "Payment" WHERE user_id = $1`, [userIdToDelete]);
    await db.query(`DELETE FROM "SubscriptionUsage" WHERE user_id = $1`, [userIdToDelete]);

    // d. Delete events created by the user (which triggers database cascading deletes on invitations, guests, check-ins, registries, registry_contributions, messages, message_recipients, SecurityAlert, AuditLog)
    await db.query("DELETE FROM events WHERE created_by = $1", [userIdToDelete]);

    // e. Delete the user
    await db.query("DELETE FROM users WHERE id = $1", [userIdToDelete]);

    await db.query("COMMIT");

    // 4. Audit logging
    console.log(`[Audit] Admin (ID: ${adminUserId}) deleted User (ID: ${userIdToDelete}, Email: ${targetUser.email}) at ${new Date().toISOString()}`);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (rbError) {
      console.error("Rollback failed:", rbError);
    }
    console.error("Admin Delete User Error:", error);
    return res.status(500).json({ error: error.message || "Server error deleting user." });
  }
};

module.exports = {
  getBillingStats,
  getBillingUsers,
  updateUserPlan,
  resetUsage,
  updateSubscriptionStatus,
  updateBillingStatus,
  deleteUser,
};
