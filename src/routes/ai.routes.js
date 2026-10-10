const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");

// POST /api/ai/generate-event
router.post("/generate-event", authMiddleware, aiController.generateStructuredEventWithAI);

// POST /api/ai/scan-invitation — Card OCR & Layer Separation for uploaded cards
router.post("/scan-invitation", aiController.scanInvitationImage);

// POST /api/ai/generate-event-template — Replicate AI image generation for invitation backgrounds
router.post("/generate-event-template", aiController.generateEventTemplate);

// POST /api/ai/generate-video-template — Replicate AI Video Generation
router.post("/generate-video-template", aiController.generateVideoTemplate);

// GET /api/ai/video-status/:predictionId — Replicate Video Prediction Polling
router.get("/video-status/:predictionId", aiController.checkVideoStatus);

module.exports = router;
