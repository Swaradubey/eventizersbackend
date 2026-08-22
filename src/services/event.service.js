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
      e.id, 
      e.title, 
      e.description, 
      e.event_type AS "eventType", 
      e.venue, 
      e.address, 
      e.city, 
      e.state, 
      e.country, 
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS "eventDate", 
      e.event_time AS "eventTime", 
      e.cover_image AS "coverImage", 
      e.selected_template_id AS "selectedTemplateId",
      e.status, 
      e.created_by AS "createdBy", 
      e.created_at AS "createdAt", 
      e.updated_at AS "updatedAt",
      COALESCE(stats.total_guests, 0)::int AS "totalGuests",
      COALESCE(stats.attending_count, 0)::int AS "attendingCount",
      COALESCE(stats.declined_count, 0)::int AS "declinedCount",
      COALESCE(stats.rsvp_rate, 0)::int AS "rsvpRate"
     FROM events e
     LEFT JOIN (
       SELECT 
         event_id,
         COUNT(*)::int AS total_guests,
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted') 
              OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted')
         )::int AS attending_count,
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(status, '')) IN ('declined', 'rejected') 
              OR LOWER(COALESCE(rsvp_status, '')) IN ('declined', 'rejected')
         )::int AS declined_count,
         ROUND(
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted') 
                OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted')
           ) * 100.0 / NULLIF(COUNT(*), 0)
         )::int AS rsvp_rate
       FROM guests
       GROUP BY event_id
     ) stats ON e.id = stats.event_id
     WHERE e.created_by = $1
     ORDER BY e.created_at DESC`,
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
      e.id, 
      e.title, 
      e.description, 
      e.event_type AS "eventType", 
      e.venue, 
      e.address, 
      e.city, 
      e.state, 
      e.country, 
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS "eventDate", 
      e.event_time AS "eventTime", 
      e.cover_image AS "coverImage", 
      e.selected_template_id AS "selectedTemplateId",
      e.status, 
      e.created_by AS "createdBy", 
      e.created_at AS "createdAt", 
      e.updated_at AS "updatedAt",
      COALESCE(stats.total_guests, 0)::int AS "totalGuests",
      COALESCE(stats.attending_count, 0)::int AS "attendingCount",
      COALESCE(stats.declined_count, 0)::int AS "declinedCount",
      COALESCE(stats.rsvp_rate, 0)::int AS "rsvpRate"
     FROM events e
     LEFT JOIN (
       SELECT 
         event_id,
         COUNT(*)::int AS total_guests,
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted') 
              OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted')
         )::int AS attending_count,
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(status, '')) IN ('declined', 'rejected') 
              OR LOWER(COALESCE(rsvp_status, '')) IN ('declined', 'rejected')
         )::int AS declined_count,
         ROUND(
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted') 
                OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted')
           ) * 100.0 / NULLIF(COUNT(*), 0)
         )::int AS rsvp_rate
       FROM guests
       GROUP BY event_id
     ) stats ON e.id = stats.event_id
     WHERE e.id = $1 AND e.created_by = $2`,
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
    selectedTemplateId,
    status
  } = eventData;

  let parsedEventDate = new Date(eventDate);
  if (isNaN(parsedEventDate.getTime())) {
    parsedEventDate = new Date();
    parsedEventDate.setDate(parsedEventDate.getDate() + 30);
  }

  let parsedEventTime;
  if (eventTime instanceof Date && !isNaN(eventTime.getTime())) {
    parsedEventTime = eventTime;
  } else if (typeof eventTime === "string") {
    // Extract first valid HH:MM or HH:MM:SS (e.g. from "18:00 - 22:00" or "18:00")
    const match = eventTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2];
      const seconds = match[3] || '00';
      parsedEventTime = new Date(`1970-01-01T${hours}:${minutes}:${seconds}Z`);
    } else {
      parsedEventTime = new Date(`1970-01-01T18:00:00Z`);
    }
  } else {
    parsedEventTime = new Date(`1970-01-01T18:00:00Z`);
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
      selectedTemplateId: selectedTemplateId || null,
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
    selectedTemplateId: createdEvent.selectedTemplateId,
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

  let formattedDate = eventDate;
  if (eventDate) {
    const d = new Date(eventDate);
    if (!isNaN(d.getTime())) {
      formattedDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }

  let formattedTime = eventTime;
  if (eventTime) {
    if (eventTime instanceof Date && !isNaN(eventTime.getTime())) {
      formattedTime = `${String(eventTime.getUTCHours()).padStart(2, '0')}:${String(eventTime.getUTCMinutes()).padStart(2, '0')}:${String(eventTime.getUTCSeconds()).padStart(2, '0')}`;
    } else if (typeof eventTime === "string") {
      const match = eventTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        formattedTime = `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
      } else {
        formattedTime = "18:00:00";
      }
    }
  }

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
      selected_template_id AS "selectedTemplateId",
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
      formattedDate,
      formattedTime,
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
