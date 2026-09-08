const prisma = require("../config/prisma");
const cron = require("node-cron");
const db = require("../config/db");
const { sendEventReminderEmail } = require("../services/email.service");

/**
 * Process all active event reminders that are due to be sent today.
 *
 * For each enabled reminder with targetDate = (eventDate - daysBefore) matching today:
 *   - ALL: sends to all confirmed/attending guests
 *   - RSVP_PENDING: sends to guests who haven't RSVPed yet (invited but pending)
 *   - GUARANTEED: sends to guests with guaranteeStatus PENDING who confirmed attendance
 *
 * @returns {Promise<{success: boolean, emailsSent: number, eventsProcessed: number, error?: string}>}
 */
const processEventRemindersWorker = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  console.log(`[Reminders Worker] Starting run at ${now.toISOString()}. Today: ${todayStr}`);

  let emailsSent = 0;
  let eventsProcessed = 0;

  try {
    // 1. Fetch all upcoming/current events with their reminders
    const remindersResult = await db.query(
      `SELECT 
        er.id AS "reminderId",
        er.event_id AS "eventId",
        er.enabled,
        er.days_before AS "daysBefore",
        er.send_via AS "sendVia",
        er.message,
        COALESCE(er.target_audience, 'ALL') AS "targetAudience",
        e.title AS "eventTitle",
        e.event_date AS "eventDate",
        e.event_time AS "eventTime",
        e.venue AS "eventVenue",
        e.address AS "eventAddress",
        e.created_by AS "eventOwnerId"
      FROM event_reminders er
      JOIN events e ON er.event_id = e.id
      WHERE er.enabled = true
        AND e.event_date >= CURRENT_DATE
      ORDER BY er.event_id, er.days_before DESC`
    );

    const reminders = remindersResult.rows;
    if (!reminders || reminders.length === 0) {
      console.log("[Reminders Worker] No active reminders found.");
      return { success: true, emailsSent: 0, eventsProcessed: 0, timestamp: now.toISOString() };
    }

    const processedEventIds = new Set();

    for (const reminder of reminders) {
      const eventDate = new Date(reminder.eventDate);
      // Calculate targetDate = eventDate - daysBefore
      const targetDate = new Date(eventDate);
      targetDate.setDate(targetDate.getDate() - reminder.daysBefore);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Only send if today matches the target date
      if (targetDateStr !== todayStr) {
        continue;
      }

      processedEventIds.add(reminder.eventId);

      // 2. Determine target guests based on audience
      let guestsQuery = "";
      const queryParams = [reminder.eventId];

      if (reminder.targetAudience === "GUARANTEED") {
        // Guests with guarantee status PENDING who confirmed attendance
        guestsQuery = `
          SELECT g.id, g.name, g.email, g.phone
          FROM guests g
          WHERE g.event_id = $1
            AND g.email IS NOT NULL
            AND g.email != ''
            AND LOWER(COALESCE(g.guarantee_status, 'PENDING')) = 'pending'
            AND (
              LOWER(COALESCE(g.rsvp_status, '')) IN ('confirmed', 'attending', 'accepted')
              OR LOWER(COALESCE(g.status, '')) IN ('confirmed', 'attending', 'accepted')
            )`;
      } else if (reminder.targetAudience === "RSVP_PENDING") {
        // Guests who have not RSVPed yet
        guestsQuery = `
          SELECT g.id, g.name, g.email, g.phone
          FROM guests g
          WHERE g.event_id = $1
            AND g.email IS NOT NULL
            AND g.email != ''
            AND (
              LOWER(COALESCE(g.rsvp_status, 'pending')) IN ('pending', 'invited', '')
              AND LOWER(COALESCE(g.status, 'invited')) IN ('pending', 'invited', '')
            )`;
      } else {
        // ALL: all non-declined guests
        guestsQuery = `
          SELECT g.id, g.name, g.email, g.phone
          FROM guests g
          WHERE g.event_id = $1
            AND g.email IS NOT NULL
            AND g.email != ''
            AND LOWER(COALESCE(g.rsvp_status, 'invited')) NOT IN ('declined', 'rejected')
            AND LOWER(COALESCE(g.status, 'invited')) NOT IN ('declined', 'rejected')`;
      }

      let guestsResult;
      try {
        guestsResult = await db.query(guestsQuery, queryParams);
      } catch (gErr) {
        console.error(`[Reminders Worker] Failed to fetch guests for event ${reminder.eventId}:`, gErr.message);
        continue;
      }

      const guests = guestsResult.rows || [];
      if (guests.length === 0) {
        console.log(`[Reminders Worker] No guests to notify for reminder ${reminder.reminderId} (${reminder.targetAudience}).`);
        continue;
      }

      // 3. Send reminder emails
      for (const guest of guests) {
        try {
          const result = await sendEventReminderEmail({
            guest,
            event: {
              id: reminder.eventId,
              title: reminder.eventTitle,
              eventDate: reminder.eventDate,
              eventTime: reminder.eventTime,
              venue: reminder.eventVenue,
              address: reminder.eventAddress,
            },
            reminderMessage: reminder.message,
            daysBefore: reminder.daysBefore,
            targetAudience: reminder.targetAudience,
          });
          if (result && result.success) {
            emailsSent++;
          }
        } catch (emailErr) {
          console.error(
            `[Reminders Worker] Failed to send reminder to ${guest.email} for event ${reminder.eventId}:`,
            emailErr.message
          );
        }
      }

      console.log(
        `[Reminders Worker] Processed reminder ${reminder.reminderId}: sent to ${guests.length} guest(s) for "${reminder.eventTitle}" (${reminder.targetAudience}).`
      );
    }

    eventsProcessed = processedEventIds.size;
    console.log(`[Reminders Worker] Completed: ${emailsSent} email(s) sent across ${eventsProcessed} event(s).`);

    return {
      success: true,
      emailsSent,
      eventsProcessed,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error("[Reminders Worker] Fatal error:", error.message);
    return {
      success: false,
      emailsSent,
      eventsProcessed,
      error: error.message,
      timestamp: now.toISOString(),
    };
  }
};

/**
 * Start the daily reminders cron job (runs at 08:00 AM every day)
 */
const startRemindersCron = () => {
  const task = cron.schedule("0 8 * * *", async () => {
    console.log("[Reminders Cron] Triggering daily event reminder dispatch...");
    await processEventRemindersWorker();
  });
  console.log("[Reminders Cron] Daily reminder dispatch cron scheduled (0 8 * * * = 08:00 AM).");
  return task;
};

module.exports = {
  processEventRemindersWorker,
  startRemindersCron,
};
