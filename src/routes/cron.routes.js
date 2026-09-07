const express = require("express");
const router = express.Router();
const { processNoShowsWorker } = require("../jobs/processNoShows.job");

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

router.get("/process-no-shows", handleProcessNoShows);
router.post("/process-no-shows", handleProcessNoShows);

module.exports = router;
