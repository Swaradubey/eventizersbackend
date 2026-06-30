const db = require("../config/db");

/**
 * Find all guests for events owned by a specific user
 * @param {number} userId
 * @param {string} search
 * @param {string} eventId
 * @returns {Promise<Array>}
 */
const findGuestsByUserId = async (userId, search = "", eventId = "") => {
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
    WHERE e.created_by = $1
  `;
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    query += ` AND (g.name ILIKE $${paramIndex} OR g.email ILIKE $${paramIndex} OR g.phone ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (eventId) {
    query += ` AND g.event_id = $${paramIndex}`;
    params.push(eventId);
    paramIndex++;
  }

  query += ` ORDER BY g.created_at DESC`;

  const result = await db.query(query, params);
  return result.rows;
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
    `INSERT INTO guests (event_id, name, email, phone, status)
     VALUES ($1, $2, $3, $4, $5)
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
  createGuest,
  updateGuest,
  deleteGuest,
  importGuests,
};
