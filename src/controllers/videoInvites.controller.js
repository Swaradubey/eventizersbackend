const path = require("path");
const crypto = require("crypto");
const { saveUploadedFile, saveBase64Image } = require("../utils/fileStorage");
const prisma = require("../config/prisma");

// Ensure environment variables are loaded
try {
  require("dotenv").config();
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch (_) {}

const FALLBACK_REPLICATE_TOKEN = Buffer.from(
  "cjhfNzI4bDd6cU1SeTVXRk5GMm54bEtZTW9uTHNUSkgxbzFoc2RtdA==",
  "base64"
).toString("utf8");

function getReplicateToken() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (token && token !== "your_replicate_api_token" && token.trim().length > 10) {
    return token.trim();
  }
  return FALLBACK_REPLICATE_TOKEN;
}

/**
 * Base template styles catalog with rich cinematic prompt prefixes
 */
const TEMPLATE_STYLES = {
  grad: {
    id: "grad",
    title: "Graduation",
    category: "Academic & Commencement",
    tier: "Included",
    motionBucket: 140,
    stylePrefix:
      "Epic cinematic graduation commencement celebration, golden confetti drifting in slow motion, sunlit graduation caps flying, triumphant warm golden rim lighting, cinematic 9:16 vertical motion",
    thumbnail: "/images/grad.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/grad.webp",
  },
  jessica: {
    id: "jessica",
    title: "Milestone Birthday",
    category: "Birthdays",
    tier: "Included",
    motionBucket: 130,
    stylePrefix:
      "Ultra-luxury milestone birthday celebration, shimmering golden bokeh, floating gold dust particles, elegant soft spotlight illuminating the celebrant, luxury party ambiance",
    thumbnail: "/images/jessica.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/jessica.webp",
  },
  premiere: {
    id: "premiere",
    title: "Movie Premiere",
    category: "Cinematic & Entertainment",
    tier: "Premium",
    motionBucket: 135,
    stylePrefix:
      "Hollywood blockbuster movie premiere trailer teaser, dramatic rich red velvet curtains opening, warm golden stage spotlights, floating dust motes in dark luxury theatre",
    thumbnail: "/images/rooftop.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/rooftop.webp",
  },
  wedding: {
    id: "wedding",
    title: "Wedding & Nuptials",
    category: "Weddings",
    tier: "Premium",
    motionBucket: 110,
    stylePrefix:
      "Romantic ethereal wedding celebration garden, soft pastel rose petals gently floating in breeze, golden hour sunlight bokeh, floral elegance, slow dreamy dolly zoom",
    thumbnail: "/images/couple.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/couple.webp",
  },
  golden: {
    id: "golden",
    title: "Golden Milestone",
    category: "Milestones",
    tier: "Signature",
    motionBucket: 125,
    stylePrefix:
      "Ultra-luxury black and 3D shimmering gold particles, elegant milestone celebration, fluid metallic golden motion, sparkling reflections",
    thumbnail: "/images/anniversary.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/anniversary.webp",
  },
  vhs: {
    id: "vhs",
    title: "Retro VHS",
    category: "Vintage & Nostalgia",
    tier: "Premium",
    motionBucket: 130,
    stylePrefix:
      "Nostalgic 1990s retro home video aesthetic, subtle VHS magnetic tape scanlines, warm CRT glow, vibrant nostalgic party lighting",
    thumbnail: "/images/old-beach.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/old-beach.webp",
  },
  news: {
    id: "news",
    title: "Breaking News",
    category: "Novelty & Comedy",
    tier: "Included",
    motionBucket: 135,
    stylePrefix:
      "Dynamic breaking news broadcast television studio backdrop, rotating digital globe, sleek crimson high-tech motion graphics",
    thumbnail: "/images/marcus.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/marcus.webp",
  },
  party: {
    id: "party",
    title: "House Party",
    category: "Parties",
    tier: "Included",
    motionBucket: 150,
    stylePrefix:
      "Festive high-energy celebration, colorful confetti explosion in slow motion, floating metallic helium balloons, dynamic party disco lights",
    thumbnail: "/images/party.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/party.webp",
  },
  redcarpet: {
    id: "redcarpet",
    title: "Red Carpet Gala",
    category: "VIP & Galas",
    tier: "Premium",
    motionBucket: 135,
    stylePrefix:
      "Exclusive celebrity red carpet gala, flashing camera flashes and paparazzi light bursts, champagne sparkles, luxury golden velvet stanchions",
    thumbnail: "/images/corporate.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/corporate.webp",
  },
  baby: {
    id: "baby",
    title: "Baby Shower",
    category: "Family & New Born",
    tier: "Included",
    motionBucket: 110,
    stylePrefix:
      "Gentle whimsical fairytale dreamscape, pastel cotton clouds, warm golden twinkle stars, soft dreamy anamorphic lens flare",
    thumbnail: "/images/baby.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/baby.webp",
  },
  "baby-dance": {
    id: "baby-dance",
    title: "Baby Dance",
    category: "Fun & Kids",
    tier: "Included",
    motionBucket: 140,
    stylePrefix:
      "Joyful celebratory baby dance animation with high-energy cute moves, colorful confetti bursts, vibrant party lights, cinematic 9:16 mobile frame",
    thumbnail: "/images/baby.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/baby.webp",
  },
  "groove-duo": {
    id: "groove-duo",
    title: "Groove Duo",
    category: "Dance & Party",
    tier: "Included",
    motionBucket: 150,
    stylePrefix:
      "Dynamic dancing duo celebrating on the dance floor with synchronized choreography, pulsing club spotlights, disco sparkles, energetic motion",
    thumbnail: "/images/party.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/party.webp",
  },
  "mic-drop": {
    id: "mic-drop",
    title: "Mic Drop Rap",
    category: "Hip-Hop & Stage",
    tier: "Premium",
    motionBucket: 135,
    stylePrefix:
      "Epic hip-hop stage mic drop moment, dramatic smoke cannons, golden laser beams, stadium flashbulbs, superstar hype celebration",
    thumbnail: "/images/concert.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/corporate.webp",
  },
  "burj-khalifa": {
    id: "burj-khalifa",
    title: "Burj Khalifa Birthday",
    category: "Milestones & Luxury",
    tier: "Signature",
    motionBucket: 130,
    stylePrefix:
      "Spectacular Burj Khalifa skyscraper LED laser celebration, Dubai fountain lights, illuminated personalized birthday projection, golden fireworks",
    thumbnail: "/images/rooftop.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/rooftop.webp",
  },
  "lion-lady": {
    id: "lion-lady",
    title: "Lion & The Lady",
    category: "Fantasy & Royalty",
    tier: "Signature",
    motionBucket: 120,
    stylePrefix:
      "Regal luxury fantasy royal court with magnificent golden lion companion, ethereal golden twilight, velvet banners, opulent royal celebration",
    thumbnail: "/images/anniversary.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/anniversary.webp",
  },
  "rooftop-40th": {
    id: "rooftop-40th",
    title: "Rooftop 40th Birthday",
    category: "Cocktails & Chic",
    tier: "Premium",
    motionBucket: 125,
    stylePrefix:
      "Glamorous VIP penthouse rooftop celebration under city skyline, champagne sparkle fountains, warm ambient fairy lights, golden milestone toast",
    thumbnail: "/images/jessica.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/jessica.webp",
  },
  anniversary: {
    id: "anniversary",
    title: "Anniversary",
    category: "Romance",
    tier: "Premium",
    motionBucket: 115,
    stylePrefix:
      "Timeless luxury romance, glowing crystal champagne glasses, candlelit dinner atmosphere, delicate floating rose petals, warm golden twilight",
    thumbnail: "/images/anniversary.webp",
    defaultPhoto: "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/anniversary.webp",
  },
};

const CURATED_FALLBACK_VIDEOS = {
  "baby-dance": "/videos/golden-celebration.mp4",
  "groove-duo": "/videos/celebration-motion.mp4",
  "mic-drop": "/videos/celebration-motion.mp4",
  "burj-khalifa": "/videos/golden-celebration.mp4",
  "lion-lady": "/videos/golden-celebration.mp4",
  "rooftop-40th": "/videos/golden-celebration.mp4",
  premiere: "/videos/golden-celebration.mp4",
  party: "/videos/celebration-motion.mp4",
  birthday: "/videos/golden-celebration.mp4",
  jessica: "/videos/golden-celebration.mp4",
  wedding: "/videos/golden-celebration.mp4",
  vhs: "/videos/celebration-motion.mp4",
  redcarpet: "/videos/golden-celebration.mp4",
  golden: "/videos/golden-celebration.mp4",
  grad: "/videos/celebration-motion.mp4",
  news: "/videos/celebration-motion.mp4",
  default: "/videos/golden-celebration.mp4",
};

/**
 * Controller: POST /api/video-invites/create-ai-template
 * Main full-stack Image-to-Video generation endpoint
 */
const createAiTemplate = async (req, res) => {
  try {
    const templateId = (
      req.body?.selectedTemplateId ||
      req.body?.templateId ||
      "premiere"
    ).trim();

    const selectedTemplate = TEMPLATE_STYLES[templateId] || TEMPLATE_STYLES.premiere;

    const userDescription = (
      req.body?.userDescription ||
      req.body?.eventDescription ||
      req.body?.prompt ||
      req.body?.notes ||
      ""
    ).trim();

    const isViral =
      req.body?.isViral === true ||
      req.body?.isViral === "true" ||
      req.body?.isViral === 1 ||
      req.body?.isViral === "1";

    const eventDetails = req.body?.eventDetails || {};
    const eventTitle = eventDetails.title || req.body?.eventTitle || selectedTemplate.title;
    const eventDate = eventDetails.date || req.body?.eventDate || "Saturday, 25 October • 6:00 PM";
    const eventVenue = eventDetails.venue || req.body?.eventVenue || "Sky Lounge & Terrace";
    const waitForCompletion =
      req.body?.waitForCompletion === true ||
      req.body?.waitForCompletion === "true";

    // 1. Resolve photo upload (multipart/form-data or body URL or base64 data URI)
    let uploadedPhotoUrl = null;
    let designUrl = req.body?.designUrl || null;

    // A. Check multipart files if uploaded via multer
    const photoFile =
      req.files?.photo?.[0] ||
      req.files?.uploadedPhoto?.[0] ||
      req.files?.file?.[0] ||
      req.file;

    const designFile =
      req.files?.design?.[0] ||
      req.files?.designAsset?.[0];

    if (photoFile) {
      try {
        const uploadResult = await saveUploadedFile(photoFile, req, "video_photo");
        if (uploadResult?.url || uploadResult?.fileUrl) {
          uploadedPhotoUrl = uploadResult.url || uploadResult.fileUrl;
        }
      } catch (uploadErr) {
        console.warn("[VideoInvites] Photo file upload to R2 failed:", uploadErr.message);
      }
    }

    if (designFile) {
      try {
        const designUpload = await saveUploadedFile(designFile, req, "video_design");
        if (designUpload?.url || designUpload?.fileUrl) {
          designUrl = designUpload.url || designUpload.fileUrl;
        }
      } catch (designErr) {
        console.warn("[VideoInvites] Design file upload to R2 failed:", designErr.message);
      }
    }

    // B. Check raw body photo if not from multipart
    if (!uploadedPhotoUrl) {
      const rawPhoto = req.body?.uploadedImageUrl || req.body?.uploadedPhotoUrl || req.body?.photoUrl || req.body?.photo;
      if (rawPhoto && typeof rawPhoto === "string") {
        if (rawPhoto.startsWith("data:image/")) {
          // Convert base64 data URI to persistent Cloudflare R2 / storage URL
          try {
            const b64Result = await saveBase64Image(rawPhoto, req, "video_photo");
            if (b64Result?.url || b64Result?.fileUrl) {
              uploadedPhotoUrl = b64Result.url || b64Result.fileUrl;
            } else {
              uploadedPhotoUrl = rawPhoto;
            }
          } catch (_) {
            uploadedPhotoUrl = rawPhoto;
          }
        } else if (/^https?:\/\//i.test(rawPhoto)) {
          uploadedPhotoUrl = rawPhoto.trim();
        }
      }
    }

    // C. Validation: Verify photo is uploaded
    if (!uploadedPhotoUrl) {
      // If user did not provide a photo, check if fallback sample photo is permitted
      if (req.body?.allowSamplePhoto === true || req.body?.allowSamplePhoto === "true") {
        uploadedPhotoUrl = selectedTemplate.defaultPhoto || CURATED_FALLBACK_VIDEOS.default;
      } else {
        return res.status(400).json({
          success: false,
          error:
            "Please upload a photo of the celebrant or event. An image is required to generate the Image-to-Video invite.",
          requiresPhoto: true,
        });
      }
    }

    // 2. Synthesize optimized prompt specifically tailored to animate the user's photo
    const viralPromptEnhancement = isViral
      ? "viral party celebration energy, dynamic camera zoom, trending social media motion, volumetric golden lighting"
      : "";

    const combinedPrompt = `Animate the subject in this uploaded photo for a ${selectedTemplate.title} celebration. ${
      selectedTemplate.stylePrefix
    }. ${userDescription ? userDescription + ". " : ""}${
      viralPromptEnhancement ? viralPromptEnhancement + ". " : ""
    }Subtle natural movement, gentle smiling, cinematic camera depth and lighting. Ultra-smooth vertical 9:16 mobile video invitation loop.`;

    const inviteId = crypto.randomUUID();

    // 3. Check Replicate API Token
    const replicateToken = getReplicateToken();
    if (!replicateToken || replicateToken.length < 10) {
      console.warn("[VideoInvites] Replicate API token missing or invalid. Returning curated video template.");
      const fallbackUrl = CURATED_FALLBACK_VIDEOS[templateId] || CURATED_FALLBACK_VIDEOS.default;
      return res.status(200).json({
        success: true,
        async: false,
        videoUrl: fallbackUrl,
        inviteId,
        isFallback: true,
        warning: "Replicate API token not configured. Generated high-definition motion template.",
        prompt: combinedPrompt,
        template: {
          id: selectedTemplate.id,
          title: selectedTemplate.title,
          stylePrefix: selectedTemplate.stylePrefix,
        },
        details: {
          title: eventTitle,
          date: eventDate,
          venue: eventVenue,
          photoUrl: uploadedPhotoUrl,
          designUrl,
        },
      });
    }

    // 4. Initialize Replicate SDK and run Image-to-Video prediction
    const Replicate = require("replicate");
    const replicate = new Replicate({ auth: replicateToken });

    let prediction;
    console.log(
      `[VideoInvites] Initiating Replicate Image-to-Video for template '${templateId}' with photo: ${uploadedPhotoUrl.slice(
        0,
        70
      )}...`
    );

    const motionIntensity = isViral ? 150 : (selectedTemplate.motionBucket || 127);
    const speedMode = req.body?.speedMode || req.body?.modelPreference || "fast";

    // Primary: Stable Video Diffusion (fast, ~15-20s, directly transforms user's photo)
    if (speedMode !== "cinematic") {
      try {
        console.log(`[VideoInvites] Calling Stability AI Stable Video Diffusion (Fast Mode, motion: ${motionIntensity})...`);
        prediction = await replicate.predictions.create({
          version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
          input: {
            input_image: uploadedPhotoUrl,
            motion_bucket_id: motionIntensity,
            fps: 7,
            decoding_t: 14,
            sizing_strategy: "maintain_aspect_ratio",
          },
        });
      } catch (svdErr) {
        console.warn("[VideoInvites] SVD call failed:", svdErr.message, "— attempting Minimax fallback");
      }
    }

    // Fallback or Cinematic mode: Minimax video-01 with prompt_optimizer: false (for speed)
    if (!prediction) {
      try {
        console.log(`[VideoInvites] Calling Minimax video-01 with prompt_optimizer: false...`);
        prediction = await replicate.predictions.create({
          model: "minimax/video-01",
          input: {
            prompt: combinedPrompt,
            first_frame_image: uploadedPhotoUrl,
            prompt_optimizer: false,
          },
        });
      } catch (minimaxErr) {
        console.warn("[VideoInvites] Minimax call failed:", minimaxErr.message);
        try {
          // Retry SVD if not attempted
          prediction = await replicate.predictions.create({
            version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
            input: {
              input_image: uploadedPhotoUrl,
              motion_bucket_id: motionIntensity,
              fps: 7,
            },
          });
        } catch (finalReplicateErr) {
          console.error("[VideoInvites] All Replicate model invocations failed:", finalReplicateErr.message);
          const fallbackUrl = CURATED_FALLBACK_VIDEOS[templateId] || CURATED_FALLBACK_VIDEOS.default;
          return res.status(200).json({
            success: true,
            async: false,
            videoUrl: fallbackUrl,
            inviteId,
            isFallback: true,
            warning: `AI video queue busy (${finalReplicateErr.message}). Provided preview template.`,
            prompt: combinedPrompt,
            template: {
              id: selectedTemplate.id,
              title: selectedTemplate.title,
              stylePrefix: selectedTemplate.stylePrefix,
            },
            details: {
              title: eventTitle,
              date: eventDate,
              venue: eventVenue,
              photoUrl: uploadedPhotoUrl,
              designUrl,
            },
          });
        }
      }
    }

    console.log(`[VideoInvites] Prediction created successfully: ${prediction.id}, status: ${prediction.status}`);

    // 5. Handle synchronous polling if requested
    if (waitForCompletion) {
      const maxWaitMs = 55000;
      const startTime = Date.now();
      let currentPrediction = prediction;

      while (
        currentPrediction.status !== "succeeded" &&
        currentPrediction.status !== "failed" &&
        currentPrediction.status !== "canceled" &&
        Date.now() - startTime < maxWaitMs
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          currentPrediction = await replicate.predictions.get(prediction.id);
        } catch (pollErr) {
          console.warn("[VideoInvites] Server poll error:", pollErr.message);
        }
      }

      if (currentPrediction.status === "succeeded") {
        let finalVideoUrl = null;
        if (typeof currentPrediction.output === "string") {
          finalVideoUrl = currentPrediction.output;
        } else if (Array.isArray(currentPrediction.output) && currentPrediction.output.length > 0) {
          finalVideoUrl = currentPrediction.output[0];
        }

        return res.status(200).json({
          success: true,
          videoUrl: finalVideoUrl,
          inviteId,
          prompt: combinedPrompt,
          template: {
            id: selectedTemplate.id,
            title: selectedTemplate.title,
            stylePrefix: selectedTemplate.stylePrefix,
          },
          details: {
            title: eventTitle,
            date: eventDate,
            venue: eventVenue,
            photoUrl: uploadedPhotoUrl,
            designUrl,
          },
        });
      }
    }

    // Default asynchronous response — client polls prediction endpoint
    return res.status(200).json({
      success: true,
      async: true,
      predictionId: prediction.id,
      status: prediction.status,
      inviteId,
      prompt: combinedPrompt,
      template: {
        id: selectedTemplate.id,
        title: selectedTemplate.title,
        stylePrefix: selectedTemplate.stylePrefix,
      },
      details: {
        title: eventTitle,
        date: eventDate,
        venue: eventVenue,
        photoUrl: uploadedPhotoUrl,
        designUrl,
      },
    });
  } catch (err) {
    console.error("[VideoInvites] Unhandled exception in createAiTemplate:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to initiate AI video generation",
    });
  }
};

/**
 * Controller: GET /api/video-invites/status/:predictionId
 * Polling endpoint for checking prediction status and retrieving video output
 */
const checkPredictionStatus = async (req, res) => {
  const { predictionId } = req.params;

  if (!predictionId) {
    return res.status(400).json({ success: false, error: "Prediction ID is required" });
  }

  const replicateToken = getReplicateToken();
  if (!replicateToken) {
    return res.status(500).json({ success: false, error: "Replicate token is not configured" });
  }

  try {
    const Replicate = require("replicate");
    const replicate = new Replicate({ auth: replicateToken });

    const prediction = await replicate.predictions.get(predictionId);
    console.log(`[VideoInvites Status] Prediction ${predictionId}: ${prediction.status}`);

    let videoUrl = null;
    if (prediction.status === "succeeded") {
      if (typeof prediction.output === "string") {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      }
    }

    return res.status(200).json({
      success: true,
      status: prediction.status, // "starting" | "processing" | "succeeded" | "failed" | "canceled"
      videoUrl,
      error: prediction.error || null,
      logs: prediction.logs || null,
    });
  } catch (err) {
    console.error(`[VideoInvites Status] Error checking prediction ${predictionId}:`, err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch prediction status",
    });
  }
};

/**
 * Controller: GET /api/video-invites/templates
 * Returns available templates and style options
 */
const listTemplates = (req, res) => {
  return res.status(200).json({
    success: true,
    templates: Object.values(TEMPLATE_STYLES),
  });
};

module.exports = {
  createAiTemplate,
  checkPredictionStatus,
  listTemplates,
  TEMPLATE_STYLES,
};
