const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");

// POST /api/ai/generate-event
router.post("/generate-event", authMiddleware, aiController.generateStructuredEventWithAI);

// POST /api/ai/scan-invitation — Gemini Vision OCR for uploaded invitation cards
router.post("/scan-invitation", authMiddleware, aiController.scanInvitationImage);

module.exports = router;
