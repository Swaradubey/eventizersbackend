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
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "previewUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "templatePreviewUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.selected_template_id AS "templateId",
      e.canvas_state AS "canvasState",
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
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "previewUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "templatePreviewUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.selected_template_id AS "templateId",
      e.canvas_state AS "canvasState",
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
    templateId,
    canvasState,
    previewUrl,
    status
  } = eventData;

  const effectiveTemplateId = selectedTemplateId || templateId || null;
  const effectivePreviewUrl = previewUrl || coverImage || null;

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
      coverImage: effectivePreviewUrl || coverImage || null,
      selectedTemplateId: effectiveTemplateId,
      canvasState: canvasState || null,
      previewUrl: effectivePreviewUrl,
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
    imageUrl: createdEvent.coverImage,
    thumbnail: createdEvent.coverImage,
    thumbnailUrl: createdEvent.coverImage,
    previewUrl: createdEvent.previewUrl || createdEvent.coverImage,
    templatePreviewUrl: createdEvent.previewUrl || createdEvent.coverImage,
    selectedTemplateId: createdEvent.selectedTemplateId,
    templateId: createdEvent.selectedTemplateId,
    canvasState: createdEvent.canvasState,
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
    selectedTemplateId,
    templateId,
    canvasState,
    previewUrl,
    status
  } = eventData;

  const effectiveTemplateId = (selectedTemplateId !== undefined && selectedTemplateId !== null)
    ? selectedTemplateId
    : ((templateId !== undefined && templateId !== null) ? templateId : null);
  const effectivePreviewUrl = (previewUrl !== undefined && previewUrl !== null)
    ? previewUrl
    : ((coverImage !== undefined && coverImage !== null) ? coverImage : null);
  let effectiveCanvasState = canvasState !== undefined ? canvasState : null;
  if (effectiveCanvasState && typeof effectiveCanvasState === "object") {
    effectiveCanvasState = JSON.stringify(effectiveCanvasState);
  }

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
      title = COALESCE($1, title), 
      description = COALESCE($2, description), 
      event_type = COALESCE($3, event_type), 
      venue = COALESCE($4, venue), 
      address = COALESCE($5, address), 
      city = COALESCE($6, city), 
      state = COALESCE($7, state), 
      country = COALESCE($8, country), 
      event_date = COALESCE($9::date, event_date), 
      event_time = COALESCE($10::time, event_time), 
      cover_image = COALESCE($11, cover_image), 
      status = COALESCE($12, status, 'draft'),
      host_name = COALESCE($13, host_name),
      email_subject = COALESCE($14, email_subject),
      email_description = COALESCE($15, email_description),
      map_url = COALESCE($16, map_url),
      directions = COALESCE($17, directions),
      parking_instructions = COALESCE($18, parking_instructions),
      entry_instructions = COALESCE($19, entry_instructions),
      floor_number = COALESCE($20, floor_number),
      room_number = COALESCE($21, room_number),
      security_gate_info = COALESCE($22, security_gate_info),
      emergency_contact = COALESCE($23, emergency_contact),
      hotel_recommendations = COALESCE($24, hotel_recommendations),
      nearby_parking = COALESCE($25, nearby_parking),
      selected_template_id = COALESCE($26, selected_template_id),
      canvas_state = COALESCE($27::jsonb, canvas_state),
      preview_url = COALESCE($28, preview_url),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $29 AND (created_by = $30 OR $30 IS NULL)
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
      COALESCE(preview_url, cover_image) AS "coverImage", 
      COALESCE(preview_url, cover_image) AS "imageUrl", 
      COALESCE(preview_url, cover_image) AS "thumbnail", 
      COALESCE(preview_url, cover_image) AS "thumbnailUrl", 
      COALESCE(preview_url, cover_image) AS "previewUrl", 
      COALESCE(preview_url, cover_image) AS "templatePreviewUrl", 
      selected_template_id AS "selectedTemplateId",
      selected_template_id AS "templateId",
      canvas_state AS "canvasState",
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
      effectivePreviewUrl || coverImage || null,
      status !== undefined && status !== null ? status : null,
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
      effectiveTemplateId || null,
      effectiveCanvasState || null,
      effectivePreviewUrl || null,
      id,
      userId || null
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
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "coverImage", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "imageUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnail", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "thumbnailUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "uploadedFileUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "previewUrl", 
      COALESCE(NULLIF(e.preview_url, ''), NULLIF(inv.image_url, ''), NULLIF(e.cover_image, '')) AS "templatePreviewUrl", 
      e.selected_template_id AS "selectedTemplateId",
      e.selected_template_id AS "templateId",
      e.canvas_state AS "canvasState",
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
  rsvpDeadlineEnabled: false,
  rsvpDeadlineDate: null,
  allowLateRsvp: false,
  allowMaybe: true,
  isPrivateGuestList: false,
  allowPlusOne: true,
  maxAdditionalGuests: 1,

  // Modal state aliases
  deadlineEnabled: false,
  deadlineDate: "",
  allowAfterDeadline: false,
  privateGuestList: false,
  allowGuestsToBringAnyone: true,

  // Legacy aliases
  rsvpDeadline: null,
  allowPlusOnes: true,
  maxPlusOnes: 1,
  allowMaybeResponse: true,
  requirePhoneNumber: false,
  collectDietaryRestrictions: false,
  collectMealPreference: false,
  collectSongRequests: false,
  customQuestions: [],
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
      rsvp_deadline_enabled AS "rsvpDeadlineEnabled",
      rsvp_deadline_date AS "rsvpDeadlineDate",
      allow_late_rsvp AS "allowLateRsvp",
      allow_maybe AS "allowMaybe",
      is_private_guest_list AS "isPrivateGuestList",
      allow_plus_one AS "allowPlusOne",
      max_additional_guests AS "maxAdditionalGuests",
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
  const rsvpDeadlineEnabled = row.rsvpDeadlineEnabled !== null && row.rsvpDeadlineEnabled !== undefined
    ? Boolean(row.rsvpDeadlineEnabled)
    : Boolean(row.rsvpDeadline);
  const rsvpDeadlineDate = row.rsvpDeadlineDate || (row.rsvpDeadline ? new Date(row.rsvpDeadline) : null);
  const allowLateRsvp = Boolean(row.allowLateRsvp);
  const allowMaybe = row.allowMaybe !== null && row.allowMaybe !== undefined
    ? Boolean(row.allowMaybe)
    : (row.allowMaybeResponse !== null && row.allowMaybeResponse !== undefined ? Boolean(row.allowMaybeResponse) : true);
  const isPrivateGuestList = Boolean(row.isPrivateGuestList);
  const allowPlusOne = row.allowPlusOne !== null && row.allowPlusOne !== undefined
    ? Boolean(row.allowPlusOne)
    : (row.allowPlusOnes !== false);
  const maxAdditionalGuests = row.maxAdditionalGuests != null
    ? Number(row.maxAdditionalGuests)
    : (row.maxPlusOnes != null ? Number(row.maxPlusOnes) : 1);

  const deadlineDateStr = rsvpDeadlineDate
    ? (typeof rsvpDeadlineDate === "string" ? rsvpDeadlineDate.split("T")[0] : rsvpDeadlineDate.toISOString().split("T")[0])
    : (row.rsvpDeadline ? String(row.rsvpDeadline).split("T")[0] : "");

  let deadlineTimeStr = "";
  if (rsvpDeadlineDate) {
    if (typeof rsvpDeadlineDate === "string" && rsvpDeadlineDate.includes("T")) {
      const t = rsvpDeadlineDate.split("T")[1];
      if (t) deadlineTimeStr = t.substring(0, 5);
    } else if (rsvpDeadlineDate instanceof Date && !isNaN(rsvpDeadlineDate.getTime())) {
      deadlineTimeStr = `${String(rsvpDeadlineDate.getUTCHours()).padStart(2, '0')}:${String(rsvpDeadlineDate.getUTCMinutes()).padStart(2, '0')}`;
    }
  }

  return {
    id: row.id,
    eventId: row.eventId,
    // Canonical schema fields
    rsvpDeadlineEnabled,
    rsvpDeadlineDate,
    allowLateRsvp,
    allowMaybe,
    isPrivateGuestList,
    allowPlusOne,
    maxAdditionalGuests,

    // Modal state aliases
    deadlineEnabled: rsvpDeadlineEnabled,
    deadlineDate: deadlineDateStr,
    deadlineTime: deadlineTimeStr,
    rsvpDeadlineTime: deadlineTimeStr,
    allowAfterDeadline: allowLateRsvp,
    privateGuestList: isPrivateGuestList,
    allowGuestsToBringAnyone: allowPlusOne,

    // Legacy fields
    rsvpDeadline: deadlineDateStr || null,
    allowPlusOnes: allowPlusOne,
    maxPlusOnes: maxAdditionalGuests,
    allowMaybeResponse: allowMaybe,
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

  const rsvpDeadlineEnabled = data.rsvpDeadlineEnabled !== undefined
    ? Boolean(data.rsvpDeadlineEnabled)
    : (data.deadlineEnabled !== undefined ? Boolean(data.deadlineEnabled) : current.rsvpDeadlineEnabled);

  let rawDeadlineDate = data.rsvpDeadlineDate !== undefined
    ? data.rsvpDeadlineDate
    : (data.deadlineDate !== undefined ? data.deadlineDate : (data.rsvpDeadline !== undefined ? data.rsvpDeadline : current.rsvpDeadlineDate));
  let rawDeadlineTime = data.rsvpDeadlineTime !== undefined
    ? data.rsvpDeadlineTime
    : (data.deadlineTime !== undefined ? data.deadlineTime : null);

  let rsvpDeadlineDate = null;
  if (rawDeadlineDate) {
    if (typeof rawDeadlineDate === "string" && !rawDeadlineDate.includes("T") && rawDeadlineTime) {
      const matchTime = String(rawDeadlineTime).match(/(\d{1,2}):(\d{2})/);
      const [year, month, day] = rawDeadlineDate.split("-").map(Number);
      if (year && month && day) {
        const h = matchTime ? Number(matchTime[1]) : 23;
        const m = matchTime ? Number(matchTime[2]) : 59;
        const d = new Date(Date.UTC(year, month - 1, day, h, m, 0, 0));
        if (!isNaN(d.getTime())) {
          rsvpDeadlineDate = d.toISOString();
        }
      }
    }
    if (!rsvpDeadlineDate) {
      const d = new Date(rawDeadlineDate);
      if (!isNaN(d.getTime())) {
        rsvpDeadlineDate = d.toISOString();
      }
    }
  }

  const allowLateRsvp = data.allowLateRsvp !== undefined
    ? Boolean(data.allowLateRsvp)
    : (data.allowAfterDeadline !== undefined ? Boolean(data.allowAfterDeadline) : current.allowLateRsvp);

  const allowMaybe = data.allowMaybe !== undefined
    ? Boolean(data.allowMaybe)
    : (data.allowMaybeResponse !== undefined ? Boolean(data.allowMaybeResponse) : current.allowMaybe);

  const isPrivateGuestList = data.isPrivateGuestList !== undefined
    ? Boolean(data.isPrivateGuestList)
    : (data.privateGuestList !== undefined ? Boolean(data.privateGuestList) : current.isPrivateGuestList);

  const allowPlusOne = data.allowPlusOne !== undefined
    ? Boolean(data.allowPlusOne)
    : (data.allowGuestsToBringAnyone !== undefined ? Boolean(data.allowGuestsToBringAnyone) : (data.allowPlusOnes !== undefined ? Boolean(data.allowPlusOnes) : current.allowPlusOne));

  const maxAdditionalGuests = data.maxAdditionalGuests !== undefined
    ? Math.max(1, Number(data.maxAdditionalGuests) || 1)
    : (data.maxPlusOnes !== undefined ? Math.max(1, Number(data.maxPlusOnes) || 1) : current.maxAdditionalGuests);

  const deadlineDateStr = rsvpDeadlineDate
    ? rsvpDeadlineDate.split("T")[0]
    : (typeof rawDeadlineDate === "string" ? rawDeadlineDate : null);

  const requirePhoneNumber = data.requirePhoneNumber !== undefined ? Boolean(data.requirePhoneNumber) : current.requirePhoneNumber;
  const collectDietaryRestrictions = data.collectDietaryRestrictions !== undefined ? Boolean(data.collectDietaryRestrictions) : current.collectDietaryRestrictions;
  const collectMealPreference = data.collectMealPreference !== undefined ? Boolean(data.collectMealPreference) : current.collectMealPreference;
  const collectSongRequests = data.collectSongRequests !== undefined ? Boolean(data.collectSongRequests) : current.collectSongRequests;
  const customQuestions = Array.isArray(data.customQuestions)
    ? JSON.stringify(data.customQuestions)
    : (data.customQuestions && typeof data.customQuestions === "string" ? data.customQuestions : JSON.stringify(current.customQuestions || []));

  const result = await db.query(
    `INSERT INTO rsvp_settings (
      id,
      event_id,
      rsvp_deadline_enabled,
      rsvp_deadline_date,
      allow_late_rsvp,
      allow_maybe,
      is_private_guest_list,
      allow_plus_one,
      max_additional_guests,
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
    ) VALUES (
      COALESCE((SELECT id FROM rsvp_settings WHERE event_id = $1), gen_random_uuid()),
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, CURRENT_TIMESTAMP
    )
    ON CONFLICT (event_id) DO UPDATE SET
      rsvp_deadline_enabled = EXCLUDED.rsvp_deadline_enabled,
      rsvp_deadline_date = EXCLUDED.rsvp_deadline_date,
      allow_late_rsvp = EXCLUDED.allow_late_rsvp,
      allow_maybe = EXCLUDED.allow_maybe,
      is_private_guest_list = EXCLUDED.is_private_guest_list,
      allow_plus_one = EXCLUDED.allow_plus_one,
      max_additional_guests = EXCLUDED.max_additional_guests,
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
      rsvp_deadline_enabled AS "rsvpDeadlineEnabled",
      rsvp_deadline_date AS "rsvpDeadlineDate",
      allow_late_rsvp AS "allowLateRsvp",
      allow_maybe AS "allowMaybe",
      is_private_guest_list AS "isPrivateGuestList",
      allow_plus_one AS "allowPlusOne",
      max_additional_guests AS "maxAdditionalGuests",
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
      rsvpDeadlineEnabled,
      rsvpDeadlineDate,
      allowLateRsvp,
      allowMaybe,
      isPrivateGuestList,
      allowPlusOne,
      maxAdditionalGuests,
      deadlineDateStr || null,
      allowPlusOne,
      maxAdditionalGuests,
      allowMaybe,
      requirePhoneNumber,
      collectDietaryRestrictions,
      collectMealPreference,
      collectSongRequests,
      customQuestions,
    ]
  );

  const row = result.rows[0];
  const retRsvpDeadlineDate = row.rsvpDeadlineDate || (row.rsvpDeadline ? new Date(row.rsvpDeadline) : null);
  const retDeadlineDateStr = retRsvpDeadlineDate
    ? (typeof retRsvpDeadlineDate === "string" ? retRsvpDeadlineDate.split("T")[0] : retRsvpDeadlineDate.toISOString().split("T")[0])
    : (row.rsvpDeadline ? String(row.rsvpDeadline).split("T")[0] : "");

  let retDeadlineTimeStr = "";
  if (retRsvpDeadlineDate) {
    if (typeof retRsvpDeadlineDate === "string" && retRsvpDeadlineDate.includes("T")) {
      const t = retRsvpDeadlineDate.split("T")[1];
      if (t) retDeadlineTimeStr = t.substring(0, 5);
    } else if (retRsvpDeadlineDate instanceof Date && !isNaN(retRsvpDeadlineDate.getTime())) {
      retDeadlineTimeStr = `${String(retRsvpDeadlineDate.getUTCHours()).padStart(2, '0')}:${String(retRsvpDeadlineDate.getUTCMinutes()).padStart(2, '0')}`;
    }
  }

  return {
    id: row.id,
    eventId: row.eventId,
    rsvpDeadlineEnabled: Boolean(row.rsvpDeadlineEnabled),
    rsvpDeadlineDate: retRsvpDeadlineDate,
    allowLateRsvp: Boolean(row.allowLateRsvp),
    allowMaybe: Boolean(row.allowMaybe),
    isPrivateGuestList: Boolean(row.isPrivateGuestList),
    allowPlusOne: Boolean(row.allowPlusOne),
    maxAdditionalGuests: Number(row.maxAdditionalGuests),

    deadlineEnabled: Boolean(row.rsvpDeadlineEnabled),
    deadlineDate: retDeadlineDateStr,
    deadlineTime: retDeadlineTimeStr,
    rsvpDeadlineTime: retDeadlineTimeStr,
    allowAfterDeadline: Boolean(row.allowLateRsvp),
    privateGuestList: Boolean(row.isPrivateGuestList),
    allowGuestsToBringAnyone: Boolean(row.allowPlusOne),

    rsvpDeadline: retDeadlineDateStr || null,
    allowPlusOnes: Boolean(row.allowPlusOne),
    maxPlusOnes: Number(row.maxAdditionalGuests),
    allowMaybeResponse: Boolean(row.allowMaybe),
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
