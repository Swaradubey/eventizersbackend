const billingService = require("../services/billing.service");

// Static plans metadata matching frontend layout requirements
const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    features: [
      "Up to 25 guests",
      "AI event creation",
      "Email invitations",
      "Basic RSVP tracking"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    features: [
      "Up to 250 guests",
      "SMS & WhatsApp invites",
      "QR Check-in",
      "Reminders & analytics"
    ]
  },
  {
    id: "business",
    name: "Business",
    price: 49,
    features: [
      "Unlimited guests",
      "Ticketing & payments",
      "Attendance guarantee",
      "Security Center",
      "Priority support"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    features: [
      "Multi-user teams",
      "SSO",
      "Advanced security",
      "Dedicated manager",
      "Custom integrations"
    ]
  }
];

/**
 * Get billing details, current plan and limits for the authenticated user
 * GET /api/dashboard/billing
 */
const getBillingInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await billingService.getBillingByUserId(userId);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json({
      success: true,
      currentPlan: data.currentPlan,
      usage: data.usage,
      plans
    });
  } catch (error) {
    console.error("Get Billing Info Error:", error);
    return res.status(500).json({ error: "Server error retrieving billing details." });
  }
};

/**
 * Update billing plan for the authenticated user
 * PATCH /api/dashboard/billing
 */
const updateBillingInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan type is required." });
    }

    const validPlans = ["free", "pro", "business", "enterprise"];
    if (!validPlans.includes(plan.toLowerCase())) {
      return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
    }

    const data = await billingService.updatePlanByUserId(userId, plan.toLowerCase());
    return res.status(200).json({
      success: true,
      currentPlan: data.currentPlan,
      usage: data.usage,
      plans
    });
  } catch (error) {
    console.error("Update Billing Info Error:", error);
    return res.status(500).json({ error: "Server error updating billing details." });
  }
};

/**
 * Get billing usage details for the authenticated user
 * GET /api/dashboard/billing/usage
 */
const getBillingUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const usage = await billingService.getBillingUsageByUserId(userId);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json(usage);
  } catch (error) {
    console.error("Get Billing Usage Error:", error);
    return res.status(500).json({ error: "Server error retrieving billing usage." });
  }
};

module.exports = {
  getBillingInfo,
  updateBillingInfo,
  getBillingUsage,
};
