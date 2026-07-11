const db = require("../config/db");

/**
 * Calculates the start date of the current billing cycle for a user.
 * For FREE users, the billing cycle anchor is their registration date (created_at).
 * For PRO/BUSINESS/ENTERPRISE users, the anchor is their plan_start_date.
 * @param {number} userId 
 * @returns {Promise<Date>} billingCycleStart
 */
const getBillingCycleStart = async (userId, client = db) => {
  const userResult = await client.query(
    `SELECT plan, plan_start_date, created_at FROM users WHERE id = $1`,
    [userId]
  );
  if (userResult.rows.length === 0) {
    return new Date();
  }
  const user = userResult.rows[0];
  const plan = (user.plan || "FREE").toLowerCase();
  
  // Use plan_start_date for non-free plans, otherwise fallback to created_at
  let anchorDate = user.created_at;
  if (plan !== "free" && user.plan_start_date) {
    anchorDate = user.plan_start_date;
  }
  
  const signupDate = new Date(anchorDate);
  const signupDay = signupDate.getDate();
  
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();
  
  if (now.getDate() < signupDay) {
    targetMonth -= 1;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    }
  }
  
  // Get the last day of targetMonth to make sure we don't overflow (e.g. 31st vs 28th/30th)
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const actualDay = Math.min(signupDay, lastDayOfTargetMonth);
  
  const billingCycleStart = new Date(targetYear, targetMonth, actualDay, 0, 0, 0, 0);
  return billingCycleStart;
};

module.exports = {
  getBillingCycleStart
};
