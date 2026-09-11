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
      e.venue_latitude AS "venueLatitude",
      e.venue_longitude AS "venueLongitude",
      COALESCE(e.geofence_radius, 150)::int AS "geofenceRadius",
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS "eventDate", 
      e.event_time AS "eventTime", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.host_name AS "hostName",
      inv.id AS "invitationId",
      inv.title AS "invitationTitle",
      inv.subtitle AS "invitationSubtitle",
      inv.main_text AS "invitationMainText",
      inv.message AS "invitationMessage",
      inv.font_family AS "invitationFontFamily",
      inv.font_weight AS "invitationFontWeight",
      inv.text_color AS "invitationTextColor",
      inv.accent_color AS "invitationAccentColor",
      inv.background_color AS "invitationBackgroundColor",
      inv.text_alignment AS "invitationTextAlignment",
      inv.event_title AS "invitationEventTitle",
      inv.event_date AS "invitationEventDate",
      inv.event_time AS "invitationEventTime",
      inv.event_venue AS "invitationEventVenue",
      e.status, 
      e.created_by AS "createdBy", 
      e.created_at AS "createdAt", 
      e.updated_at AS "updatedAt",
      COALESCE(stats.total_guests, 0)::int AS "totalGuests",
      COALESCE(stats.attending_count, 0)::int AS "attendingCount",
      COALESCE(stats.declined_count, 0)::int AS "declinedCount",
      COALESCE(stats.rsvp_rate, 0)::int AS "rsvpRate"
     FROM events e
     LEFT JOIN invitations inv ON e.id = inv.event_id
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
             WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted', 'declined', 'rejected', 'maybe') 
                OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted', 'declined', 'rejected', 'maybe')
           ) * 100.0 / NULLIF(COUNT(*), 0)
         )::int AS rsvp_rate
       FROM guests
       GROUP BY event_id
     ) stats ON e.id = stats.event_id
     WHERE e.created_by = $1
     ORDER BY e.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...row,
    invitation: row.invitationId ? {
      id: row.invitationId,
      title: row.invitationTitle,
      subtitle: row.invitationSubtitle,
      mainText: row.invitationMainText,
      message: row.invitationMessage,
      fontFamily: row.invitationFontFamily,
      fontWeight: row.invitationFontWeight,
      textColor: row.invitationTextColor,
      accentColor: row.invitationAccentColor,
      backgroundColor: row.invitationBackgroundColor,
      textAlignment: row.invitationTextAlignment,
      eventTitle: row.invitationEventTitle,
      eventDate: row.invitationEventDate,
      eventTime: row.invitationEventTime,
      eventVenue: row.invitationEventVenue,
    } : null,
  }));
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
      e.venue_latitude AS "venueLatitude",
      e.venue_longitude AS "venueLongitude",
      COALESCE(e.geofence_radius, 150)::int AS "geofenceRadius",
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS "eventDate", 
      e.event_time AS "eventTime", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.host_name AS "hostName",
      inv.id AS "invitationId",
      inv.title AS "invitationTitle",
      inv.subtitle AS "invitationSubtitle",
      inv.main_text AS "invitationMainText",
      inv.message AS "invitationMessage",
      inv.font_family AS "invitationFontFamily",
      inv.font_weight AS "invitationFontWeight",
      inv.text_color AS "invitationTextColor",
      inv.accent_color AS "invitationAccentColor",
      inv.background_color AS "invitationBackgroundColor",
      inv.text_alignment AS "invitationTextAlignment",
      inv.event_title AS "invitationEventTitle",
      inv.event_date AS "invitationEventDate",
      inv.event_time AS "invitationEventTime",
      inv.event_venue AS "invitationEventVenue",
      e.status, 
      e.created_by AS "createdBy", 
      e.created_at AS "createdAt", 
      e.updated_at AS "updatedAt",
      COALESCE(stats.total_guests, 0)::int AS "totalGuests",
      COALESCE(stats.attending_count, 0)::int AS "attendingCount",
      COALESCE(stats.declined_count, 0)::int AS "declinedCount",
      COALESCE(stats.rsvp_rate, 0)::int AS "rsvpRate"
     FROM events e
     LEFT JOIN invitations inv ON e.id = inv.event_id
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
             WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'attending', 'accepted', 'declined', 'rejected', 'maybe') 
                OR LOWER(COALESCE(rsvp_status, '')) IN ('confirmed', 'attending', 'accepted', 'declined', 'rejected', 'maybe')
           ) * 100.0 / NULLIF(COUNT(*), 0)
         )::int AS rsvp_rate
       FROM guests
       GROUP BY event_id
     ) stats ON e.id = stats.event_id
     WHERE e.id = $1 AND e.created_by = $2`,
    [id, userId]
  );
  const row = result.rows[0] || null;
  if (!row) return null;
  const event = {
    ...row,
    invitation: row.invitationId ? {
      id: row.invitationId,
      title: row.invitationTitle,
      subtitle: row.invitationSubtitle,
      mainText: row.invitationMainText,
      message: row.invitationMessage,
      fontFamily: row.invitationFontFamily,
      fontWeight: row.invitationFontWeight,
      textColor: row.invitationTextColor,
      accentColor: row.invitationAccentColor,
      backgroundColor: row.invitationBackgroundColor,
      textAlignment: row.invitationTextAlignment,
      eventTitle: row.invitationEventTitle,
      eventDate: row.invitationEventDate,
      eventTime: row.invitationEventTime,
      eventVenue: row.invitationEventVenue,
    } : null,
  };
  if (event) {
    try {
      event.rsvpSettings = await findRsvpSettingsByEventId(id);
    } catch (e) {
      console.warn("Could not load rsvp_settings:", e.message);
      event.rsvpSettings = { ...DEFAULT_RSVP_SETTINGS };
    }
    try {
      event.designSettings = await findDesignSettingsByEventId(id);
    } catch (e) {
      console.warn("Could not load design_settings:", e.message);
      event.designSettings = { ...DEFAULT_DESIGN_SETTINGS };
    }
    try {
      event.reminders = await findRemindersByEventId(id);
    } catch (e) {
      console.warn("Could not load event reminders:", e.message);
      event.reminders = [];
    }
  }
  return event;
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
    hostName,
    emailSubject,
    emailDescription,
    mapUrl,
    directions,
    parkingInstructions,
    entryInstructions,
    floorNumber,
    roomNumber,
    securityGateInfo,
    emergencyContact,
    hotelRecommendations,
    nearbyParking,
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
      host_name = $13,
      email_subject = $14,
      email_description = $15,
      map_url = $16,
      directions = $17,
      parking_instructions = $18,
      entry_instructions = $19,
      floor_number = $20,
      room_number = $21,
      security_gate_info = $22,
      emergency_contact = $23,
      hotel_recommendations = $24,
      nearby_parking = $25,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $26 AND created_by = $27
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
      host_name AS "hostName",
      email_subject AS "emailSubject",
      email_description AS "emailDescription",
      map_url AS "mapUrl",
      directions,
      parking_instructions AS "parkingInstructions",
      entry_instructions AS "entryInstructions",
      floor_number AS "floorNumber",
      room_number AS "roomNumber",
      security_gate_info AS "securityGateInfo",
      emergency_contact AS "emergencyContact",
      hotel_recommendations AS "hotelRecommendations",
      nearby_parking AS "nearbyParking",
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
      hostName || null,
      emailSubject || null,
      emailDescription || null,
      mapUrl || null,
      directions || null,
      parkingInstructions || null,
      entryInstructions || null,
      floorNumber || null,
      roomNumber || null,
      securityGateInfo || null,
      emergencyContact || null,
      hotelRecommendations || null,
      nearbyParking || null,
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

/**
 * Find a specific event by ID (and optional userId)
 * @param {string} id - UUID
 * @param {number} [userId]
 * @returns {Promise<Object|null>}
 */
const findEventById = async (id, userId) => {
  if (userId) {
    return findEventByIdAndUserId(id, userId);
  }
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
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.host_name AS "hostName",
      inv.id AS "invitationId",
      inv.title AS "invitationTitle",
      inv.subtitle AS "invitationSubtitle",
      inv.main_text AS "invitationMainText",
      inv.message AS "invitationMessage",
      inv.font_family AS "invitationFontFamily",
      inv.font_weight AS "invitationFontWeight",
      inv.text_color AS "invitationTextColor",
      inv.accent_color AS "invitationAccentColor",
      inv.background_color AS "invitationBackgroundColor",
      inv.text_alignment AS "invitationTextAlignment",
      inv.event_title AS "invitationEventTitle",
      inv.event_date AS "invitationEventDate",
      inv.event_time AS "invitationEventTime",
      inv.event_venue AS "invitationEventVenue",
      e.status, 
      e.created_by AS "createdBy", 
      e.created_at AS "createdAt", 
      e.updated_at AS "updatedAt"
     FROM events e
     LEFT JOIN invitations inv ON e.id = inv.event_id
      WHERE e.id = $1`,
    [id]
  );
  const row = result.rows[0] || null;
  if (!row) return null;
  const event = {
    ...row,
    invitation: row.invitationId ? {
      id: row.invitationId,
      title: row.invitationTitle,
      subtitle: row.invitationSubtitle,
      mainText: row.invitationMainText,
      message: row.invitationMessage,
      fontFamily: row.invitationFontFamily,
      fontWeight: row.invitationFontWeight,
      textColor: row.invitationTextColor,
      accentColor: row.invitationAccentColor,
      backgroundColor: row.invitationBackgroundColor,
      textAlignment: row.invitationTextAlignment,
      eventTitle: row.invitationEventTitle,
      eventDate: row.invitationEventDate,
      eventTime: row.invitationEventTime,
      eventVenue: row.invitationEventVenue,
    } : null,
  };
  if (event) {
    try {
      event.rsvpSettings = await findRsvpSettingsByEventId(id);
    } catch (e) {
      console.warn("Could not load rsvp_settings:", e.message);
      event.rsvpSettings = { ...DEFAULT_RSVP_SETTINGS };
    }
    try {
      event.designSettings = await findDesignSettingsByEventId(id);
    } catch (e) {
      console.warn("Could not load design_settings:", e.message);
      event.designSettings = { ...DEFAULT_DESIGN_SETTINGS };
    }
    try {
      event.reminders = await findRemindersByEventId(id);
    } catch (e) {
      console.warn("Could not load event reminders:", e.message);
      event.reminders = [];
    }
  }
  return event;
};

const DEFAULT_RSVP_SETTINGS = {
  rsvpDeadline: null,
  allowPlusOnes: true,
  maxPlusOnes: 1,
  allowMaybeResponse: false,
  requirePhoneNumber: false,
  collectDietaryRestrictions: false,
  collectMealPreference: false,
  collectSongRequests: false,
  customQuestions: []
};

/**
 * Retrieve RSVP settings for an event
 * @param {string} eventId - UUID
 * @returns {Promise<Object>}
 */
const findRsvpSettingsByEventId = async (eventId) => {
  const result = await db.query(
    `SELECT 
      id,
      event_id AS "eventId",
      rsvp_deadline AS "rsvpDeadline",
      allow_plus_ones AS "allowPlusOnes",
      max_plus_ones AS "maxPlusOnes",
      allow_maybe_response AS "allowMaybeResponse",
      require_phone_number AS "requirePhoneNumber",
      collect_dietary_restrictions AS "collectDietaryRestrictions",
      collect_meal_preference AS "collectMealPreference",
      collect_song_requests AS "collectSongRequests",
      custom_questions AS "customQuestions",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
     FROM rsvp_settings
     WHERE event_id = $1`,
    [eventId]
  );

  if (!result.rows[0]) {
    return { ...DEFAULT_RSVP_SETTINGS };
  }

  const row = result.rows[0];
  return {
    rsvpDeadline: row.rsvpDeadline || null,
    allowPlusOnes: row.allowPlusOnes !== false,
    maxPlusOnes: row.maxPlusOnes != null ? Number(row.maxPlusOnes) : 1,
    allowMaybeResponse: Boolean(row.allowMaybeResponse),
    requirePhoneNumber: Boolean(row.requirePhoneNumber),
    collectDietaryRestrictions: Boolean(row.collectDietaryRestrictions),
    collectMealPreference: Boolean(row.collectMealPreference),
    collectSongRequests: Boolean(row.collectSongRequests),
    customQuestions: Array.isArray(row.customQuestions) ? row.customQuestions : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Insert or update RSVP settings for an event
 * @param {string} eventId - UUID
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const upsertRsvpSettings = async (eventId, data = {}) => {
  const current = await findRsvpSettingsByEventId(eventId);
  const rsvpDeadline = data.rsvpDeadline !== undefined ? data.rsvpDeadline : current.rsvpDeadline;
  const allowPlusOnes = data.allowPlusOnes !== undefined ? Boolean(data.allowPlusOnes) : current.allowPlusOnes;
  const maxPlusOnes = data.maxPlusOnes !== undefined ? Math.max(1, Number(data.maxPlusOnes) || 1) : current.maxPlusOnes;
  const allowMaybeResponse = data.allowMaybeResponse !== undefined ? Boolean(data.allowMaybeResponse) : current.allowMaybeResponse;
  const requirePhoneNumber = data.requirePhoneNumber !== undefined ? Boolean(data.requirePhoneNumber) : current.requirePhoneNumber;
  const collectDietaryRestrictions = data.collectDietaryRestrictions !== undefined ? Boolean(data.collectDietaryRestrictions) : current.collectDietaryRestrictions;
  const collectMealPreference = data.collectMealPreference !== undefined ? Boolean(data.collectMealPreference) : current.collectMealPreference;
  const collectSongRequests = data.collectSongRequests !== undefined ? Boolean(data.collectSongRequests) : current.collectSongRequests;
  const customQuestions = Array.isArray(data.customQuestions)
    ? JSON.stringify(data.customQuestions)
    : (data.customQuestions && typeof data.customQuestions === "string" ? data.customQuestions : JSON.stringify(current.customQuestions || []));

  const result = await db.query(
    `INSERT INTO rsvp_settings (
      event_id,
      rsvp_deadline,
      allow_plus_ones,
      max_plus_ones,
      allow_maybe_response,
      require_phone_number,
      collect_dietary_restrictions,
      collect_meal_preference,
      collect_song_requests,
      custom_questions,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (event_id) DO UPDATE SET
      rsvp_deadline = EXCLUDED.rsvp_deadline,
      allow_plus_ones = EXCLUDED.allow_plus_ones,
      max_plus_ones = EXCLUDED.max_plus_ones,
      allow_maybe_response = EXCLUDED.allow_maybe_response,
      require_phone_number = EXCLUDED.require_phone_number,
      collect_dietary_restrictions = EXCLUDED.collect_dietary_restrictions,
      collect_meal_preference = EXCLUDED.collect_meal_preference,
      collect_song_requests = EXCLUDED.collect_song_requests,
      custom_questions = EXCLUDED.custom_questions,
      updated_at = CURRENT_TIMESTAMP
    RETURNING 
      id,
      event_id AS "eventId",
      rsvp_deadline AS "rsvpDeadline",
      allow_plus_ones AS "allowPlusOnes",
      max_plus_ones AS "maxPlusOnes",
      allow_maybe_response AS "allowMaybeResponse",
      require_phone_number AS "requirePhoneNumber",
      collect_dietary_restrictions AS "collectDietaryRestrictions",
      collect_meal_preference AS "collectMealPreference",
      collect_song_requests AS "collectSongRequests",
      custom_questions AS "customQuestions",
      created_at AS "createdAt",
      updated_at AS "updatedAt"`,
    [
      eventId,
      rsvpDeadline || null,
      allowPlusOnes,
      maxPlusOnes,
      allowMaybeResponse,
      requirePhoneNumber,
      collectDietaryRestrictions,
      collectMealPreference,
      collectSongRequests,
      customQuestions
    ]
  );

  const row = result.rows[0];
  return {
    rsvpDeadline: row.rsvpDeadline || null,
    allowPlusOnes: row.allowPlusOnes !== false,
    maxPlusOnes: row.maxPlusOnes != null ? Number(row.maxPlusOnes) : 1,
    allowMaybeResponse: Boolean(row.allowMaybeResponse),
    requirePhoneNumber: Boolean(row.requirePhoneNumber),
    collectDietaryRestrictions: Boolean(row.collectDietaryRestrictions),
    collectMealPreference: Boolean(row.collectMealPreference),
    collectSongRequests: Boolean(row.collectSongRequests),
    customQuestions: Array.isArray(row.customQuestions) ? row.customQuestions : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const DEFAULT_DESIGN_SETTINGS = {
  typography: {
    titleFont: "Playfair Display",
    bodyFont: "Questrial",
  },
  colorScheme: {
    preset: "Stripe Blurple",
    primaryColor: "#635BFF",
    secondaryColor: "#00D4FF",
    textColor: "#1F2937",
  },
  background: {
    type: "gradient",
    gradientDirection: "to-r",
    color: "#ffffff",
    patternUrl: "",
    imageUrl: "",
  },
};

/**
 * Retrieve design settings for an event
 * @param {string} eventId - UUID
 * @returns {Promise<Object>}
 */
const findDesignSettingsByEventId = async (eventId) => {
  try {
    const result = await db.query(
      `SELECT 
        id,
        event_id AS "eventId",
        typography,
        color_scheme AS "colorScheme",
        background,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM design_settings
       WHERE event_id = $1`,
      [eventId]
    );

    if (!result.rows[0]) {
      return { ...DEFAULT_DESIGN_SETTINGS };
    }

    const row = result.rows[0];
    return {
      id: row.id,
      eventId: row.eventId,
      typography: {
        titleFont: row.typography?.titleFont || DEFAULT_DESIGN_SETTINGS.typography.titleFont,
        bodyFont: row.typography?.bodyFont || DEFAULT_DESIGN_SETTINGS.typography.bodyFont,
      },
      colorScheme: {
        preset: row.colorScheme?.preset || DEFAULT_DESIGN_SETTINGS.colorScheme.preset,
        primaryColor: row.colorScheme?.primaryColor || DEFAULT_DESIGN_SETTINGS.colorScheme.primaryColor,
        secondaryColor: row.colorScheme?.secondaryColor || DEFAULT_DESIGN_SETTINGS.colorScheme.secondaryColor,
        textColor: row.colorScheme?.textColor || DEFAULT_DESIGN_SETTINGS.colorScheme.textColor,
      },
      background: {
        type: row.background?.type || DEFAULT_DESIGN_SETTINGS.background.type,
        gradientDirection: row.background?.gradientDirection || DEFAULT_DESIGN_SETTINGS.background.gradientDirection,
        color: row.background?.color || DEFAULT_DESIGN_SETTINGS.background.color,
        patternUrl: row.background?.patternUrl || DEFAULT_DESIGN_SETTINGS.background.patternUrl,
        imageUrl: row.background?.imageUrl || DEFAULT_DESIGN_SETTINGS.background.imageUrl,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    console.warn("Could not query design_settings:", err.message);
    return { ...DEFAULT_DESIGN_SETTINGS };
  }
};

/**
 * Insert or update design settings for an event
 * @param {string} eventId - UUID
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const upsertDesignSettings = async (eventId, data = {}) => {
  const current = await findDesignSettingsByEventId(eventId);

  const typography = {
    titleFont: data?.typography?.titleFont || current?.typography?.titleFont || DEFAULT_DESIGN_SETTINGS.typography.titleFont,
    bodyFont: data?.typography?.bodyFont || current?.typography?.bodyFont || DEFAULT_DESIGN_SETTINGS.typography.bodyFont,
  };

  const colorScheme = {
    preset: data?.colorScheme?.preset || current?.colorScheme?.preset || DEFAULT_DESIGN_SETTINGS.colorScheme.preset,
    primaryColor: data?.colorScheme?.primaryColor || current?.colorScheme?.primaryColor || DEFAULT_DESIGN_SETTINGS.colorScheme.primaryColor,
    secondaryColor: data?.colorScheme?.secondaryColor || current?.colorScheme?.secondaryColor || DEFAULT_DESIGN_SETTINGS.colorScheme.secondaryColor,
    textColor: data?.colorScheme?.textColor || current?.colorScheme?.textColor || DEFAULT_DESIGN_SETTINGS.colorScheme.textColor,
  };

  const background = {
    type: data?.background?.type || current?.background?.type || DEFAULT_DESIGN_SETTINGS.background.type,
    gradientDirection: data?.background?.gradientDirection !== undefined ? data.background.gradientDirection : (current?.background?.gradientDirection || "to-r"),
    color: data?.background?.color !== undefined ? data.background.color : (current?.background?.color || "#ffffff"),
    patternUrl: data?.background?.patternUrl !== undefined ? data.background.patternUrl : (current?.background?.patternUrl || ""),
    imageUrl: data?.background?.imageUrl !== undefined ? data.background.imageUrl : (current?.background?.imageUrl || ""),
  };

  const result = await db.query(
    `INSERT INTO design_settings (
      event_id,
      typography,
      color_scheme,
      background,
      updated_at
    ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (event_id) DO UPDATE SET
      typography = EXCLUDED.typography,
      color_scheme = EXCLUDED.color_scheme,
      background = EXCLUDED.background,
      updated_at = CURRENT_TIMESTAMP
    RETURNING 
      id,
      event_id AS "eventId",
      typography,
      color_scheme AS "colorScheme",
      background,
      created_at AS "createdAt",
      updated_at AS "updatedAt"`,
    [
      eventId,
      JSON.stringify(typography),
      JSON.stringify(colorScheme),
      JSON.stringify(background),
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    eventId: row.eventId,
    typography: row.typography || typography,
    colorScheme: row.colorScheme || colorScheme,
    background: row.background || background,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const DEFAULT_EVENT_REMINDERS = [
  {
    enabled: true,
    daysBefore: 14,
    sendVia: "Email",
    message: "Don't forget to RSVP for our event!",
  },
  {
    enabled: true,
    daysBefore: 7,
    sendVia: "Email",
    message: "Only one week left! We hope to see you there.",
  },
];

/**
 * Retrieve all reminders for an event
 * @param {string} eventId - UUID
 * @returns {Promise<Array>}
 */
const findRemindersByEventId = async (eventId, targetAudience = null) => {
  try {
    let queryStr = `SELECT 
        id,
        event_id AS "eventId",
        enabled,
        days_before AS "daysBefore",
        send_via AS "sendVia",
        message,
        COALESCE(target_audience, 'ALL') AS "targetAudience",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM event_reminders
       WHERE event_id = $1`;
    const params = [eventId];
    if (targetAudience) {
      queryStr += ` AND target_audience = $2`;
      params.push(targetAudience);
    }
    queryStr += ` ORDER BY days_before DESC, created_at ASC`;

    const result = await db.query(queryStr, params);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    return result.rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      enabled: Boolean(row.enabled),
      daysBefore: Number(row.daysBefore),
      sendVia: row.sendVia,
      message: row.message || "",
      targetAudience: row.targetAudience || "ALL",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (err) {
    console.warn("Could not query event_reminders:", err.message);
    return [];
  }
};

/**
 * Replace/overwrite all reminders for an event
 * @param {string} eventId - UUID
 * @param {Array} reminders - Array of reminder objects
 * @returns {Promise<Array>}
 */
const updateRemindersForEvent = async (eventId, reminders = []) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Delete existing reminders for this event
    await client.query("DELETE FROM event_reminders WHERE event_id = $1", [eventId]);

    const insertedRows = [];

    if (Array.isArray(reminders) && reminders.length > 0) {
      for (const item of reminders) {
        const enabled = item.enabled !== undefined ? Boolean(item.enabled) : true;
        const daysBefore = !isNaN(Number(item.daysBefore)) ? Number(item.daysBefore) : 3;
        const sendVia = item.sendVia || "Email";
        const message = typeof item.message === "string" ? item.message : "";
        const targetAudience = ["ALL", "RSVP_PENDING", "GUARANTEED"].includes(item.targetAudience)
          ? item.targetAudience
          : "ALL";

        const res = await client.query(
          `INSERT INTO event_reminders (
            event_id,
            enabled,
            days_before,
            send_via,
            message,
            target_audience,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING 
            id,
            event_id AS "eventId",
            enabled,
            days_before AS "daysBefore",
            send_via AS "sendVia",
            message,
            COALESCE(target_audience, 'ALL') AS "targetAudience",
            created_at AS "createdAt",
            updated_at AS "updatedAt"`,
          [eventId, enabled, daysBefore, sendVia, message, targetAudience]
        );
        if (res.rows[0]) {
          insertedRows.push({
            id: res.rows[0].id,
            eventId: res.rows[0].eventId,
            enabled: Boolean(res.rows[0].enabled),
            daysBefore: Number(res.rows[0].daysBefore),
            sendVia: res.rows[0].sendVia,
            message: res.rows[0].message || "",
            targetAudience: res.rows[0].targetAudience || "ALL",
            createdAt: res.rows[0].createdAt,
            updatedAt: res.rows[0].updatedAt,
          });
        }
      }
    }

    await client.query("COMMIT");
    return insertedRows;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating reminders for event:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findEventsByUserId,
  findEventByIdAndUserId,
  findEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  findRsvpSettingsByEventId,
  upsertRsvpSettings,
  DEFAULT_RSVP_SETTINGS,
  findDesignSettingsByEventId,
  upsertDesignSettings,
  DEFAULT_DESIGN_SETTINGS,
  findRemindersByEventId,
  updateRemindersForEvent,
  DEFAULT_EVENT_REMINDERS,
};
