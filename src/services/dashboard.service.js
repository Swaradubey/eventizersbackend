const db = require("../config/db");

/**
 * Get dashboard statistics for a specific user
 * @param {number} userId
 * @returns {Promise<Object>} { totalEvents, totalGuests, avgRsvpRate, messagesSent }
 */
const getStatsByUserId = async (userId) => {
  // Total events created by this user
  const eventsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE created_by = $1`,
    [userId]
  );
  const totalEvents = eventsResult.rows[0].count;

  // Total guests across all events owned by this user
  const guestsResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM guests g
     JOIN events e ON g.event_id = e.id
     WHERE e.created_by = $1`,
    [userId]
  );
  const totalGuests = guestsResult.rows[0].count;

  // Average RSVP rate: (confirmed guests / total guests) * 100
  const rsvpResult = await db.query(
    `SELECT 
       COALESCE(
         ROUND(
           COUNT(*) FILTER (WHERE g.status = 'confirmed') * 100.0 / NULLIF(COUNT(*), 0)
         ),
         0
       )::int AS rate
     FROM guests g
     JOIN events e ON g.event_id = e.id
     WHERE e.created_by = $1`,
    [userId]
  );
  const avgRsvpRate = rsvpResult.rows[0].rate;

  // Messages sent — no messages table exists yet, so query returns 0
  // When a messages table is added, replace with:
  // SELECT COUNT(*)::int FROM messages m JOIN events e ON m.event_id = e.id WHERE e.created_by = $1
  const messagesSent = 0;

  return {
    totalEvents,
    totalGuests,
    avgRsvpRate,
    messagesSent
  };
};

module.exports = {
  getStatsByUserId
};
