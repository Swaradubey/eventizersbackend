const db = require("../config/db");

/**
 * Get analytics overview for the logged-in user
 * GET /api/analytics/overview
 */
const getOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        COUNT(*)::int AS "totalInvitations",
        COUNT(CASE WHEN g.status = 'confirmed' OR g.status = 'attending' OR g.rsvp_status = 'attending' THEN 1 END)::int AS "attendingCount",
        COUNT(CASE WHEN g.status = 'declined' OR g.rsvp_status = 'declined' THEN 1 END)::int AS "declinedCount",
        COUNT(CASE WHEN g.status = 'maybe' OR g.rsvp_status = 'maybe' THEN 1 END)::int AS "maybeCount",
        COUNT(CASE WHEN g.sent_at IS NOT NULL THEN 1 END)::int AS "sentCount",
        COUNT(CASE WHEN g.opened_at IS NOT NULL THEN 1 END)::int AS "openedCount",
        COUNT(CASE WHEN g.clicked_at IS NOT NULL THEN 1 END)::int AS "clickedCount",
        AVG(CASE WHEN g.sent_at IS NOT NULL AND g.responded_at IS NOT NULL AND g.responded_at >= g.sent_at 
                 THEN EXTRACT(EPOCH FROM (g.responded_at - g.sent_at)) 
            END)::float AS "avgResponseSeconds"
      FROM guests g
      JOIN events e ON g.event_id = e.id
      WHERE e.created_by = $1
    `;

    const result = await db.query(query, [userId]);
    const row = result.rows[0] || {};

    const totalInvitations = row.totalInvitations || 0;
    const attendingCount = row.attendingCount || 0;
    const declinedCount = row.declinedCount || 0;
    const maybeCount = row.maybeCount || 0;
    
    // Remaining guests are pending
    const pendingCount = Math.max(0, totalInvitations - (attendingCount + declinedCount + maybeCount));

    const responseRate = totalInvitations > 0 
      ? parseFloat(((attendingCount + declinedCount + maybeCount) / totalInvitations * 100).toFixed(1))
      : 0;

    const sentCount = row.sentCount || 0;
    const openedCount = row.openedCount || 0;
    const clickedCount = row.clickedCount || 0;

    const openRate = sentCount > 0 
      ? parseFloat((openedCount / sentCount * 100).toFixed(1))
      : 0;

    const clickRate = sentCount > 0 
      ? parseFloat((clickedCount / sentCount * 100).toFixed(1))
      : 0;

    const avgResponseSeconds = row.avgResponseSeconds || 0;
    const averageResponseTimeDays = parseFloat((avgResponseSeconds / 86400).toFixed(1));

    // Calculate percentages (rounded to nearest integer or as required)
    const attendingPercentage = totalInvitations > 0 ? Math.round((attendingCount / totalInvitations) * 100) : 0;
    const declinedPercentage = totalInvitations > 0 ? Math.round((declinedCount / totalInvitations) * 100) : 0;
    const maybePercentage = totalInvitations > 0 ? Math.round((maybeCount / totalInvitations) * 100) : 0;
    const pendingPercentage = totalInvitations > 0 ? Math.round((pendingCount / totalInvitations) * 100) : 0;

    return res.status(200).json({
      success: true,
      totalInvitations,
      responseRate,
      clickRate,
      averageResponseTimeDays,
      rsvpBreakdown: {
        attending: {
          count: attendingCount,
          percentage: attendingPercentage
        },
        declined: {
          count: declinedCount,
          percentage: declinedPercentage
        },
        maybe: {
          count: maybeCount,
          percentage: maybePercentage
        },
        pending: {
          count: pendingCount,
          percentage: pendingPercentage
        }
      },
      eventPerformance: {
        openRate,
        clickRate
      }
    });
  } catch (error) {
    console.error("Get Analytics Overview Error:", {
      query: "getOverview",
      message: error.message,
      code: error.code,
      detail: error.detail,
      position: error.position,
      stack: error.stack
    });
    return res.status(500).json({ error: "Server error retrieving analytics overview." });
  }
};

module.exports = {
  getOverview,
};
