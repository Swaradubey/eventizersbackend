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

const { optionalAuthMiddleware } = require("../middleware/auth.middleware");

// Attach optional authentication so logged in users have req.user populated
router.use(optionalAuthMiddleware);

// POST /api/video-invites/generate — Main Seedance video generation endpoint with credit check & transaction lock
router.post("/generate", uploadFields, videoInvitesController.generateVideoInvite);

// GET /api/video-invites/credits — Get current available credits for user or guest
router.get("/credits", videoInvitesController.getUserCredits);

// POST /api/video-invites/buy-credits — Purchase credits modal trigger
router.post("/buy-credits", videoInvitesController.buyCredits);

// POST /api/video-invites/create-ai-template — Backward compatibility alias
router.post("/create-ai-template", uploadFields, videoInvitesController.generateVideoInvite);

// GET /api/video-invites/status/:predictionId — Check Replicate generation status with rollback
router.get("/status/:predictionId", videoInvitesController.checkPredictionStatus);

// GET /api/video-invites/templates — Get list of supported styles and templates
router.get("/templates", videoInvitesController.listTemplates);

module.exports = router;
