const prisma = require("../config/prisma");
const cron = require("node-cron");

/**
 * Process auto-waive of pending guarantee fees for expired events.
 * Finds all events where eventDate + reviewWindowDays < NOW()
 * and updates associated guests where guaranteeStatus === 'PENDING' to 'WAIVED'.
 *
 * @returns {Promise<{success: boolean, totalWaived: number, expiredEventsCount: number}>}
 */
const processAutoWaive = async () => {
  try {
    const now = new Date();
    console.log(`[Auto-Waive Worker] Checking for expired events at ${now.toISOString()}...`);

    // 1. Fetch user attendance guarantee settings (for reviewWindowDays)
    const settings = await prisma.attendanceGuaranteeSetting.findMany({
      select: {
        userId: true,
        reviewWindowDays: true,
        isEnabled: true,
      },
    });

    const settingsMap = new Map();
    settings.forEach((s) => {
      settingsMap.set(s.userId, s.reviewWindowDays || 7);
    });

    // 2. Fetch all events whose eventDate has passed
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
        createdBy: true,
      },
    });

    const expiredEventIds = [];

    for (const evt of pastEvents) {
      const reviewDays = settingsMap.get(evt.createdBy) ?? 7;
      const reviewExpiryDate = new Date(evt.eventDate);
      reviewExpiryDate.setDate(reviewExpiryDate.getDate() + reviewDays);

      if (reviewExpiryDate < now) {
        expiredEventIds.push(evt.id);
      }
    }

    let totalWaived = 0;

    if (expiredEventIds.length > 0) {
      const updateResult = await prisma.guest.updateMany({
        where: {
          eventId: { in: expiredEventIds },
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

      totalWaived = updateResult.count;
    }

    console.log(
      `[Auto-Waive Worker] Finished check. Waived guarantee for ${totalWaived} guest(s) across ${expiredEventIds.length} expired event(s).`
    );

    return {
      success: true,
      totalWaived,
      expiredEventsCount: expiredEventIds.length,
    };
  } catch (error) {
    console.error("[Auto-Waive Worker] Error processing auto-waive:", error);
    return {
      success: false,
      error: error.message || "Unknown error during auto-waive processing",
    };
  }
};

/**
 * Start scheduled cron job to run daily at 00:00:00 (midnight)
 */
const startAutoWaiveCron = () => {
  // Schedule to run every day at midnight (00:00)
  const task = cron.schedule("0 0 * * *", async () => {
    console.log("[Auto-Waive Cron] Running daily scheduled auto-waive task...");
    await processAutoWaive();
  });

  console.log("[Auto-Waive Cron] Daily auto-waive background cron job scheduled successfully (0 0 * * *).");
  return task;
};

module.exports = {
  processAutoWaive,
  startAutoWaiveCron,
};
