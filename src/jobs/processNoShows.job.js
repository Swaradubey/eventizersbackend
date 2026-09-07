const prisma = require("../config/prisma");
const cron = require("node-cron");
const { sendNoShowPenaltyNoticeEmail } = require("../services/email.service");

/**
 * Process automated No-Show penalty notices and timeline auto-waives.
 *
 * Step A: Query events where event has concluded and attendance guarantee is enabled.
 * Step B: Identify guests who confirmed RSVP, have no check-in, penaltyNoticeSentAt is null, and guaranteeStatus is PENDING.
 * Step C: Dispatch No-Show Penalty Notice email to each matching guest.
 * Step D: Update guest record with penaltyNoticeSentAt = new Date().
 * Step E: Auto-waive pending guarantee fees for expired review window timeline.
 *
 * @returns {Promise<{success: boolean, eventsProcessed: number, noticesSent: number, totalWaived: number, error?: string}>}
 */
const processNoShowsWorker = async () => {
  const now = new Date();
  console.log(`[No-Show Worker] Starting run at ${now.toISOString()}...`);

  let noticesSent = 0;
  let totalWaived = 0;
  let processedEventsCount = 0;

  try {
    // 1. Fetch user attendance guarantee settings
    const allSettings = await prisma.attendanceGuaranteeSetting.findMany({
      select: {
        userId: true,
        isEnabled: true,
        guaranteeAmount: true,
        reviewWindowDays: true,
      },
    });

    const settingsMap = new Map();
    allSettings.forEach((s) => {
      settingsMap.set(s.userId, {
        isEnabled: s.isEnabled !== false,
        guaranteeAmount: s.guaranteeAmount ? parseFloat(s.guaranteeAmount) : 25.0,
        reviewWindowDays: s.reviewWindowDays || 7,
      });
    });

    // 2. Step A: Query past events (where eventDate < now)
    const pastEvents = await prisma.event.findMany({
      where: {
        eventDate: {
          lt: now,
        },
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        eventTime: true,
        venue: true,
        address: true,
        createdBy: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        eventDate: "desc",
      },
    });

    for (const event of pastEvents) {
      const hostSetting = settingsMap.get(event.createdBy) || {
        isEnabled: true,
        guaranteeAmount: 25.0,
        reviewWindowDays: 7,
      };

      // Skip events if the host explicitly disabled attendance guarantee
      if (!hostSetting.isEnabled) {
        continue;
      }

      processedEventsCount++;
      const { guaranteeAmount, reviewWindowDays } = hostSetting;

      // Calculate review window expiry
      const reviewExpiryDate = new Date(event.eventDate);
      reviewExpiryDate.setDate(reviewExpiryDate.getDate() + reviewWindowDays);

      // Step E (Timeline Auto-Waive on Expiry):
      // If event.endDate + (reviewWindowDays * 24 * 60 * 60 * 1000) < NOW() and guaranteeStatus === 'PENDING'
      if (reviewExpiryDate < now) {
        const waiveResult = await prisma.guest.updateMany({
          where: {
            eventId: event.id,
            OR: [
              { guaranteeStatus: "PENDING" },
              { guaranteeStatus: null },
            ],
          },
          data: {
            guaranteeStatus: "WAIVED",
            guaranteeWaivedAt: now,
          },
        });

        if (waiveResult.count > 0) {
          totalWaived += waiveResult.count;
          console.log(
            `[No-Show Worker] Auto-waived ${waiveResult.count} guest(s) for expired review window in event "${event.title}" (${event.id}).`
          );
        }
      }

      // Step B: Identify guests for these events where:
      // - rsvpStatus IN ('attending', 'confirmed', 'yes')
      // - No associated record exists in checkIns
      // - penaltyNoticeSentAt is null
      // - guaranteeStatus === 'PENDING'
      const absentGuests = await prisma.guest.findMany({
        where: {
          eventId: event.id,
          OR: [
            { rsvpStatus: { in: ["attending", "confirmed", "yes", "ATTENDING", "CONFIRMED", "YES", "Confirmed", "Attending"] } },
            { status: { in: ["confirmed", "attending", "CONFIRMED", "ATTENDING"] } },
          ],
          checkIns: {
            none: {},
          },
          penaltyNoticeSentAt: null,
          OR: [
            { guaranteeStatus: "PENDING" },
            { guaranteeStatus: null },
          ],
        },
      });

      // Steps C & D: Dispatch No-Show Penalty Notice email and update penaltyNoticeSentAt
      for (const guest of absentGuests) {
        try {
          console.log(`[No-Show Worker] Dispatching penalty notice to ${guest.email} for event "${event.title}"...`);
          
          const emailResult = await sendNoShowPenaltyNoticeEmail({
            guest,
            event,
            host: event.user,
            guaranteeAmount,
            reviewWindowDays,
          });

          // Step D: Update guest record with penaltyNoticeSentAt = new Date()
          await prisma.guest.update({
            where: { id: guest.id },
            data: {
              penaltyNoticeSentAt: new Date(),
            },
          });

          noticesSent++;
          console.log(`[No-Show Worker] Successfully recorded penalty notice dispatch for guest ${guest.id} (${guest.email}).`);
        } catch (guestErr) {
          console.error(`[No-Show Worker] Error processing guest ${guest.id} (${guest.email}):`, guestErr.message);
        }
      }
    }

    console.log(
      `[No-Show Worker] Run completed. Events checked: ${processedEventsCount}, Penalty notices sent: ${noticesSent}, Auto-waived guests: ${totalWaived}.`
    );

    return {
      success: true,
      eventsProcessed: processedEventsCount,
      noticesSent,
      totalWaived,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error("[No-Show Worker] Fatal error running worker:", error);
    return {
      success: false,
      eventsProcessed: processedEventsCount,
      noticesSent,
      totalWaived,
      error: error.message || "Unknown error occurred during no-show processing",
      timestamp: now.toISOString(),
    };
  }
};

/**
 * Start daily scheduled background cron job via node-cron (00:00:00 midnight)
 */
const startProcessNoShowsCron = () => {
  const task = cron.schedule("0 0 * * *", async () => {
    console.log("[No-Show Cron] Triggering daily automated no-show processing...");
    await processNoShowsWorker();
  });

  console.log("[No-Show Cron] Daily automated no-show background cron scheduled (0 0 * * *).");
  return task;
};

module.exports = {
  processNoShowsWorker,
  startProcessNoShowsCron,
};
