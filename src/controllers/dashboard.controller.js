const dashboardService = require("../services/dashboard.service");

/**
 * Get dashboard statistics for the logged-in user
 * GET /api/dashboard/stats
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await dashboardService.getStatsByUserId(userId);
    return res.status(200).json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);
    return res.status(500).json({ error: "Server error retrieving dashboard statistics." });
  }
};

module.exports = {
  getStats
};
