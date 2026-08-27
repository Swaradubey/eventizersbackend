const express = require("express");
const router = express.Router();
const trackController = require("../controllers/track.controller");

// Public GET endpoint for 1x1 tracking pixel
router.get("/open", trackController.trackEmailOpen);

// Public GET endpoint for link click tracking & redirect
router.get("/click", trackController.trackEmailClick);

module.exports = router;
