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
        COUNT(CASE 
          WHEN LOWER(COALESCE(g.status, '')) IN ('confirmed', 'attending', 'accepted') 
            OR LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed', 'attending', 'accepted') THEN 1 
        END)::int AS "attendingCount",
        COUNT(CASE 
          WHEN LOWER(COALESCE(g.status, '')) IN ('declined', 'rejected') 
            OR LOWER(COALESCE(g.rsvp_status, '')) IN ('declined', 'rejected') THEN 1 
        END)::int AS "declinedCount",
        COUNT(CASE 
          WHEN LOWER(COALESCE(g.status, '')) = 'maybe' 
            OR LOWER(COALESCE(g.rsvp_status, '')) = 'maybe' THEN 1 
        END)::int AS "maybeCount",
        COUNT(CASE WHEN g.sent_at IS NOT NULL THEN 1 END)::int AS "sentCount",
        COUNT(CASE 
          WHEN g.opened_at IS NOT NULL 
            OR g.is_opened = true 
            OR g.clicked_at IS NOT NULL 
            OR g.is_clicked = true 
            OR LOWER(COALESCE(g.status, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') 
            OR LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') THEN 1 
        END)::int AS "openedCount",
        COUNT(CASE 
          WHEN g.clicked_at IS NOT NULL 
            OR g.is_clicked = true 
            OR LOWER(COALESCE(g.status, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') 
            OR LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') THEN 1 
        END)::int AS "clickedCount",
        AVG(CASE 
          WHEN g.sent_at IS NOT NULL AND g.responded_at IS NOT NULL AND g.responded_at >= g.sent_at 
            THEN EXTRACT(EPOCH FROM (g.responded_at - g.sent_at)) 
          WHEN g.sent_at IS NOT NULL AND g.opened_at IS NOT NULL AND g.opened_at >= g.sent_at
            THEN EXTRACT(EPOCH FROM (g.opened_at - g.sent_at))
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

    const openedCount = row.openedCount || 0;
    const clickedCount = row.clickedCount || 0;

    const openDenominator = totalInvitations;
    const openRate = openDenominator > 0 
      ? parseFloat(((openedCount / openDenominator) * 100).toFixed(1))
      : 0;

    const clickDenominator = totalInvitations;
    const clickRate = clickDenominator > 0 
      ? parseFloat(((clickedCount / clickDenominator) * 100).toFixed(1))
      : 0;

    const avgResponseSeconds = row.avgResponseSeconds || 0;
    const averageResponseTimeDays = parseFloat((avgResponseSeconds / 86400).toFixed(1));

    // Calculate percentages (rounded to nearest integer or as required)
    const attendingPercentage = totalInvitations > 0 ? Math.round((attendingCount / totalInvitations) * 100) : 0;
    const declinedPercentage = totalInvitations > 0 ? Math.round((declinedCount / totalInvitations) * 100) : 0;
    const maybePercentage = totalInvitations > 0 ? Math.round((maybeCount / totalInvitations) * 100) : 0;
    const pendingPercentage = totalInvitations > 0 ? Math.round((pendingCount / totalInvitations) * 100) : 0;

    // ── Per-event performance breakdown ──
    const eventsPerformanceQuery = `
      SELECT
        e.id,
        e.title AS name,
        COUNT(g.id)::int AS "totalGuests",
        CASE WHEN COUNT(g.id) > 0
          THEN ROUND(
            COUNT(CASE 
              WHEN LOWER(COALESCE(g.status, '')) IN ('confirmed','attending','declined','maybe','accepted')
                OR LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed','attending','declined','maybe','accepted') THEN 1 
            END)::numeric
            / COUNT(g.id) * 100, 1)
          ELSE 0
        END AS "rsvpRate",
        CASE WHEN COUNT(g.id) > 0
          THEN ROUND(
            COUNT(CASE 
              WHEN g.opened_at IS NOT NULL 
                OR g.is_opened = true 
                OR g.clicked_at IS NOT NULL 
                OR g.is_clicked = true 
                OR LOWER(COALESCE(g.status, '')) IN ('confirmed','attending','declined','maybe','accepted')
                OR LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed','attending','declined','maybe','accepted') THEN 1 
            END)::numeric
            / COUNT(g.id) * 100, 1)
          ELSE 0
        END AS "openRate"
      FROM events e
      LEFT JOIN guests g ON g.event_id = e.id
      WHERE e.created_by = $1
      GROUP BY e.id, e.title, e.event_date
      ORDER BY e.event_date DESC
    `;

    const eventsResult = await db.query(eventsPerformanceQuery, [userId]);
    const eventsPerformance = eventsResult.rows.map((r) => ({
      id: r.id,
      name: r.name,
      totalGuests: r.totalGuests || 0,
      rsvpRate: parseFloat(r.rsvpRate) || 0,
      openRate: parseFloat(r.openRate) || 0,
    }));

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
      },
      eventsPerformance
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
