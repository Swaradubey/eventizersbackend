const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");

// POST /api/ai/generate-event
router.post("/generate-event", authMiddleware, aiController.generateStructuredEventWithAI);

// POST /api/ai/scan-invitation — Gemini Vision OCR & Layer Separation for uploaded cards
router.post("/scan-invitation", aiController.scanInvitationImage);

module.exports = router;
