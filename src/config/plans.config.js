

const BILLING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    features: [
      "Up to 3 events/year",
      "25 guests per event",
      "Basic invitation templates",
      "Email invitations",
      "RSVP tracking",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    features: [
      "Up to 250 guests",
      "SMS & WhatsApp invites",
      "QR Check-in",
      "Reminders & analytics",
    ],
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
      "Priority support",
    ],
  },
];

/** Valid paid plan IDs that require Stripe Checkout */
const PAID_PLAN_IDS = ["pro", "business"];

/** All valid plan IDs */
const VALID_PLAN_IDS = ["free", "pro", "business"];


function getStripePriceId(planId) {
  const isPlaceholder = function (v) {
    if (!v) return true;
    var lower = v.toLowerCase();
    return (
      lower.indexOf("replace_me") !== -1 ||
      lower.indexOf("yyyyyy") !== -1 ||
      lower.indexOf("xxxxxx") !== -1 ||
      lower.indexOf("your_") !== -1
    );
  };

  if (planId === "pro") {
    var proId = process.env.STRIPE_PRO_PRICE_ID;
    var trimmedPro = proId ? proId.trim() : null;
    return isPlaceholder(trimmedPro) ? null : trimmedPro;
  }
  if (planId === "business") {
    var bizId = process.env.STRIPE_BUSINESS_PRICE_ID;
    var trimmedBiz = bizId ? bizId.trim() : null;
    return isPlaceholder(trimmedBiz) ? null : trimmedBiz;
  }
  return null;
}


function normalizePlanId(rawPlan) {
  var plan = (rawPlan || "free").toLowerCase().trim();
  if (plan === "host") return "business";
  if (VALID_PLAN_IDS.indexOf(plan) !== -1) return plan;
  return "free";
}

module.exports = {
  BILLING_PLANS,
  PAID_PLAN_IDS,
  VALID_PLAN_IDS,
  getStripePriceId,
  normalizePlanId,
};
