const subscriptionService = require("../services/subscription.service");

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

module.exports = {
  subscribe,
};
