const express = require("express");
const router = express.Router();
const { processNoShowsWorker } = require("../jobs/processNoShows.job");
const { processEventRemindersWorker } = require("../jobs/reminders.job");

/**
 * Trigger automated No-Show penalty notice emails and timeline auto-waives.
 * POST /api/cron/process-no-shows
 * GET /api/cron/process-no-shows
 */
const handleProcessNoShows = async (req, res) => {
  try {
    const result = await processNoShowsWorker();
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Cron Route] Error in /api/cron/process-no-shows:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute no-show processing",
    });
  }
};

/**
 * Trigger event reminder dispatch worker on demand.
 * POST /api/cron/send-reminders
 * GET /api/cron/send-reminders
 */
const handleSendReminders = async (req, res) => {
  try {
    const result = await processEventRemindersWorker();
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Cron Route] Error in /api/cron/send-reminders:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute reminder dispatch",
    });
  }
};

router.get("/process-no-shows", handleProcessNoShows);
router.post("/process-no-shows", handleProcessNoShows);
router.get("/send-reminders", handleSendReminders);
router.post("/send-reminders", handleSendReminders);

module.exports = router;
