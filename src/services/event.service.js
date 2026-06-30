const db = require("../config/db");
const prisma = require("../config/prisma");

/**
 * Find all events created by a specific user
 * @param {number} userId
 * @returns {Promise<Array>}
 */
const findEventsByUserId = async (userId) => {
  const result = await db.query(
    `SELECT 
      id, 
      title, 
      description, 
      event_type AS "eventType", 
      venue, 
      address, 
      city, 
      state, 
      country, 
      TO_CHAR(event_date, 'YYYY-MM-DD') AS "eventDate", 
      event_time AS "eventTime", 
      cover_image AS "coverImage", 
      status, 
      created_by AS "createdBy", 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
     FROM events 
     WHERE created_by = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

/**
 * Find a specific event by ID and User ID
 * @param {string} id - UUID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const findEventByIdAndUserId = async (id, userId) => {
  const result = await db.query(
    `SELECT 
      id, 
      title, 
      description, 
      event_type AS "eventType", 
      venue, 
      address, 
      city, 
      state, 
      country, 
      TO_CHAR(event_date, 'YYYY-MM-DD') AS "eventDate", 
      event_time AS "eventTime", 
      cover_image AS "coverImage", 
      status, 
      created_by AS "createdBy", 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
     FROM events 
     WHERE id = $1 AND created_by = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
};

/**
 * Create a new event
 * @param {Object} eventData
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const createEvent = async (eventData, userId) => {
  const {
    title,
    description,
    eventType,
    venue,
    address,
    city,
    state,
    country,
    eventDate,
    eventTime,
    coverImage,
    status
  } = eventData;

  const parsedEventDate = new Date(eventDate);

  let parsedEventTime;
  if (eventTime instanceof Date) {
    parsedEventTime = eventTime;
  } else {
    const timeStr = eventTime.includes(":") && eventTime.split(":").length === 2 ? `${eventTime}:00` : eventTime;
    parsedEventTime = new Date(`1970-01-01T${timeStr}Z`);
  }

  const createdEvent = await prisma.event.create({
    data: {
      title,
      description: description || null,
      eventType: eventType || null,
      venue,
      address: address || null,
      city: city || null,
      state: state || null,
      country: country || null,
      eventDate: parsedEventDate,
      eventTime: parsedEventTime,
      coverImage: coverImage || null,
      status: status || 'draft',
      createdBy: Number(userId),
    }
  });

  return {
    id: createdEvent.id,
    title: createdEvent.title,
    description: createdEvent.description,
    eventType: createdEvent.eventType,
    venue: createdEvent.venue,
    address: createdEvent.address,
    city: createdEvent.city,
    state: createdEvent.state,
    country: createdEvent.country,
    eventDate: createdEvent.eventDate instanceof Date
      ? `${createdEvent.eventDate.getUTCFullYear()}-${String(createdEvent.eventDate.getUTCMonth() + 1).padStart(2, '0')}-${String(createdEvent.eventDate.getUTCDate()).padStart(2, '0')}`
      : createdEvent.eventDate,
    eventTime: createdEvent.eventTime instanceof Date
      ? `${String(createdEvent.eventTime.getUTCHours()).padStart(2, '0')}:${String(createdEvent.eventTime.getUTCMinutes()).padStart(2, '0')}:${String(createdEvent.eventTime.getUTCSeconds()).padStart(2, '0')}`
      : createdEvent.eventTime,
    coverImage: createdEvent.coverImage,
    status: createdEvent.status,
    createdBy: createdEvent.createdBy,
    createdAt: createdEvent.createdAt,
    updatedAt: createdEvent.updatedAt,
  };
};

/**
 * Update an existing event
 * @param {string} id - UUID
 * @param {Object} eventData
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const updateEvent = async (id, eventData, userId) => {
  const {
    title,
    description,
    eventType,
    venue,
    address,
    city,
    state,
    country,
    eventDate,
    eventTime,
    coverImage,
    status
  } = eventData;

  const result = await db.query(
    `UPDATE events SET 
      title = $1, 
      description = $2, 
      event_type = $3, 
      venue = $4, 
      address = $5, 
      city = $6, 
      state = $7, 
      country = $8, 
      event_date = $9, 
      event_time = $10, 
      cover_image = $11, 
      status = $12,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $13 AND created_by = $14
     RETURNING 
      id, 
      title, 
      description, 
      event_type AS "eventType", 
      venue, 
      address, 
      city, 
      state, 
      country, 
      TO_CHAR(event_date, 'YYYY-MM-DD') AS "eventDate", 
      event_time AS "eventTime", 
      cover_image AS "coverImage", 
      status, 
      created_by AS "createdBy", 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"`,
    [
      title,
      description || null,
      eventType || null,
      venue,
      address || null,
      city || null,
      state || null,
      country || null,
      eventDate,
      eventTime,
      coverImage || null,
      status || 'draft',
      id,
      userId
    ]
  );
  return result.rows[0] || null;
};

/**
 * Delete an event
 * @param {string} id - UUID
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const deleteEvent = async (id, userId) => {
  const result = await db.query(
    "DELETE FROM events WHERE id = $1 AND created_by = $2 RETURNING id",
    [id, userId]
  );
  return result.rowCount > 0;
};

module.exports = {
  findEventsByUserId,
  findEventByIdAndUserId,
  createEvent,
  updateEvent,
  deleteEvent
};
