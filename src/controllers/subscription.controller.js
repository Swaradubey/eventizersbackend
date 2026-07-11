const subscriptionService = require("../services/subscription.service");
const db = require("../config/db");

/**
 * POST /api/plans/subscribe
 * Subscribes user to the selected plan, triggering Stripe SetupIntent if a card is missing.
 */
const subscribe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "planId is required."
      });
    }

    const result = await subscriptionService.subscribeToPlan(userId, planId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Subscription purchase error:", error);

    if (error.message?.includes("Stripe is not configured")) {
      return res.status(503).json({
        success: false,
        error: "Payment service is currently unavailable. Please try again later."
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Server error processing subscription."
    });
  }
};

/**
 * GET /api/plans/current-plan
 * Gets the current active plan of the authenticated user from the database.
 */
const getCurrentPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await db.query(
      `SELECT plan FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const currentPlan = userResult.rows[0].plan;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json({
      success: true,
      currentPlan: currentPlan
    });
  } catch (error) {
    console.error("Get current plan error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving current plan."
    });
  }
};

module.exports = {
  subscribe,
  getCurrentPlan,
};
