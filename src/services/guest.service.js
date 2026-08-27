const db = require("../config/db");

/**
 * Find all guests for events owned by a specific user
 * @param {number} userId
 * @param {string} search
 * @param {string} eventId
 * @param {number|null} page
 * @param {number|null} limit
 * @returns {Promise<{guests: Array, total: number}>}
 */
const findGuestsByUserId = async (userId, search = "", eventId = "", page = null, limit = null) => {
  let whereClause = `WHERE e.created_by = $1`;
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    whereClause += ` AND (g.name ILIKE $${paramIndex} OR g.email ILIKE $${paramIndex} OR g.phone ILIKE $${paramIndex} OR g.status ILIKE $${paramIndex} OR e.title ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (eventId) {
    whereClause += ` AND g.event_id = $${paramIndex}`;
    params.push(eventId);
    paramIndex++;
  }

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM guests g
    JOIN events e ON g.event_id = e.id
    ${whereClause}
  `;

  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  let query = `
    SELECT 
      g.id, 
      g.event_id AS "eventId", 
      g.name, 
      g.email, 
      g.phone, 
      g.status, 
      g.created_at AS "createdAt", 
      g.updated_at AS "updatedAt",
      e.title AS "eventTitle"
    FROM guests g
    JOIN events e ON g.event_id = e.id
    ${whereClause}
    ORDER BY g.created_at DESC
  `;

  if (page !== null && limit !== null) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (parsedPage - 1) * parsedLimit;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parsedLimit, offset);
  }

  const result = await db.query(query, params);
  return {
    guests: result.rows,
    total,
  };
};

/**
 * Find a specific guest by ID and user ID
 * @param {string} id - UUID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const findGuestById = async (id, userId) => {
  const result = await db.query(
    `SELECT 
      g.id, 
      g.event_id AS "eventId", 
      g.name, 
      g.email, 
      g.phone, 
      g.status, 
      g.created_at AS "createdAt", 
      g.updated_at AS "updatedAt",
      e.title AS "eventTitle"
     FROM guests g
     JOIN events e ON g.event_id = e.id
     WHERE g.id = $1 AND e.created_by = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
};

/**
 * Create a new guest
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const createGuest = async (data) => {
  const { eventId, name, email, phone, status } = data;
  const result = await db.query(
    `INSERT INTO guests (id, event_id, name, email, phone, status, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     RETURNING 
      id, 
      event_id AS "eventId", 
      name, 
      email, 
      phone, 
      status, 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"`,
    [eventId, name, email, phone || null, status || "invited"]
  );
  return result.rows[0];
};

/**
 * Update an existing guest
 * @param {string} id - UUID
 * @param {Object} data
 * @returns {Promise<Object|null>}
 */
const updateGuest = async (id, data) => {
  const { name, email, phone, status, eventId } = data;
  const result = await db.query(
    `UPDATE guests SET 
      name = COALESCE($1, name), 
      email = COALESCE($2, email), 
      phone = COALESCE($3, phone), 
      status = COALESCE($4, status),
      event_id = COALESCE($5, event_id),
      is_opened = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') THEN true 
        ELSE is_opened 
      END,
      is_clicked = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') THEN true 
        ELSE is_clicked 
      END,
      opened_at = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') AND opened_at IS NULL THEN CURRENT_TIMESTAMP 
        ELSE opened_at 
      END,
      clicked_at = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') AND clicked_at IS NULL THEN CURRENT_TIMESTAMP 
        ELSE clicked_at 
      END,
      responded_at = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') AND responded_at IS NULL THEN CURRENT_TIMESTAMP 
        ELSE responded_at 
      END,
      open_count = CASE 
        WHEN LOWER(COALESCE($4, '')) IN ('confirmed', 'attending', 'declined', 'maybe', 'accepted') AND (open_count IS NULL OR open_count = 0) THEN 1 
        ELSE open_count 
      END,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING 
      id, 
      event_id AS "eventId", 
      name, 
      email, 
      phone, 
      status, 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"`,
    [name, email, phone || null, status, eventId, id]
  );
  return result.rows[0] || null;
};

/**
 * Delete a guest
 * @param {string} id - UUID
 * @returns {Promise<boolean>}
 */
const deleteGuest = async (id) => {
  const result = await db.query(
    "DELETE FROM guests WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rowCount > 0;
};

/**
 * Find guest by email and event ID
 * @param {string} email
 * @param {string} eventId
 * @returns {Promise<Object|null>}
 */
const findGuestByEmailAndEventId = async (email, eventId) => {
  const result = await db.query(
    `SELECT id FROM guests WHERE email = $1 AND event_id = $2 LIMIT 1`,
    [email, eventId]
  );
  return result.rows[0] || null;
};

/**
 * Batch import guests
 * @param {Array} guestsList
 * @returns {Promise<Array>}
 */
const importGuests = async (guestsList) => {
  const inserted = [];
  for (const guest of guestsList) {
    const res = await createGuest(guest);
    inserted.push(res);
  }
  return inserted;
};

module.exports = {
  findGuestsByUserId,
  findGuestById,
  findGuestByEmailAndEventId,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuests,
};
