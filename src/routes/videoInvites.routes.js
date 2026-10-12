const express = require("express");
const multer = require("multer");
const router = express.Router();
const videoInvitesController = require("../controllers/videoInvites.controller");

// Setup Multer for multipart/form-data uploads (in-memory buffering before R2 upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/heic", "image/heif"];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are supported."));
    }
  },
});

const uploadFields = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "uploadedPhoto", maxCount: 1 },
  { name: "file", maxCount: 1 },
  { name: "design", maxCount: 1 },
  { name: "designAsset", maxCount: 1 },
]);

// POST /api/video-invites/create-ai-template — Generate AI video invite from uploaded photo & prompt
router.post("/create-ai-template", uploadFields, videoInvitesController.createAiTemplate);

// GET /api/video-invites/status/:predictionId — Check Replicate generation status
router.get("/status/:predictionId", videoInvitesController.checkPredictionStatus);

// GET /api/video-invites/templates — Get list of supported styles and templates
router.get("/templates", videoInvitesController.listTemplates);

module.exports = router;
