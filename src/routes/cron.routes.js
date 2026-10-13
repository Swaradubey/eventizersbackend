const express = require("express");
const router = express.Router();

/**
 * No-Show penalty notice processing route (jobs removed)
 */
const handleProcessNoShows = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Background no-show processing job is retired.",
    processed: 0,
  });
};

/**
 * Event reminder dispatch route (jobs removed)
 */
const handleSendReminders = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Background reminder dispatch job is retired.",
    remindersSent: 0,
  });
};

router.get("/process-no-shows", handleProcessNoShows);
router.post("/process-no-shows", handleProcessNoShows);
router.get("/send-reminders", handleSendReminders);
router.post("/send-reminders", handleSendReminders);

module.exports = router;

