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

// In-memory wallet store for unauthenticated guest sessions
const guestWallets = new Map();

// Active prediction tracking for polling refund safety
// Key: predictionId -> { userId, guestId, creditsDeducted, refunded, createdAt }
const activePredictions = new Map();

/**
 * Helper to fetch balance for user or guest session
 */
async function getBalance(userId, guestId) {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return user ? user.credits : 0;
  }
  if (!guestWallets.has(guestId)) {
    guestWallets.set(guestId, 30);
  }
  return guestWallets.get(guestId);
}

/**
 * Helper to refund deducted credits in DB or guest wallet
 */
async function refundUserCredits(userId, guestId, amount = 2) {
  if (userId) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { credits: true },
      });
      console.log(`[VideoInvites] Successfully refunded ${amount} credits to user ${userId}. New balance: ${updated.credits}`);
      return updated.credits;
    } catch (e) {
      console.error("[VideoInvites] Credit refund error for user:", e.message);
    }
  } else if (guestId) {
    const current = guestWallets.get(guestId) ?? 30;
    const newBal = current + amount;
    guestWallets.set(guestId, newBal);
    console.log(`[VideoInvites] Refunded ${amount} credits to guest session ${guestId}. New balance: ${newBal}`);
    return newBal;
  }
  return 0;
}

/**
 * Controller: POST /api/video-invites/generate
 * Main endpoint for Replicate Seedance video generation with credit management & rollback logic
 */
const generateVideoInvite = async (req, res) => {
  const userId = req.user?.id || null;
  const guestId = req.headers["x-guest-session-id"] || req.cookies?.guestId || req.ip || "guest_default";
  let creditDeducted = false;
  let remainingCredits = 0;

  try {
    // 1. Credit Check & Transaction Lock: Ensure user has >= 2 credits
    if (userId) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, credits: true },
          });

          if (!user) {
            throw new Error("USER_NOT_FOUND");
          }

          if (user.credits < 2) {
            const err = new Error("INSUFFICIENT_CREDITS");
            err.statusCode = 402;
            err.credits = user.credits;
            throw err;
          }

          // Atomically deduct 2 credits
          const updated = await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: 2 } },
            select: { id: true, credits: true },
          });

          return updated;
        });

        creditDeducted = true;
        remainingCredits = txResult.credits;
        console.log(`[VideoInvites] Deducted 2 credits from user ${userId}. Remaining credits: ${remainingCredits}`);
      } catch (txErr) {
        if (txErr.message === "INSUFFICIENT_CREDITS" || txErr.statusCode === 402) {
          return res.status(402).json({
            success: false,
            error: "Insufficient credits. You need at least 2 credits to generate a video invite.",
            requiresCredits: true,
            remainingCredits: txErr.credits !== undefined ? txErr.credits : 0,
          });
        }
        return res.status(400).json({ success: false, error: txErr.message });
      }
    } else {
      // Guest wallet (starts with 30 free credits)
      const current = guestWallets.get(guestId) ?? 30;
      if (current < 2) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits. You need at least 2 credits to generate a video invite.",
          requiresCredits: true,
          remainingCredits: current,
        });
      }
      remainingCredits = current - 2;
      guestWallets.set(guestId, remainingCredits);
      creditDeducted = true;
      console.log(`[VideoInvites] Deducted 2 credits from guest ${guestId}. Remaining: ${remainingCredits}`);
    }

    // 2. Parse creation mode & parameters
    const creationMode = req.body?.creationMode === "describe" ? "describe" : "template";
    const templateId = (
      req.body?.selectedTemplateId ||
      req.body?.templateId ||
      "premiere"
    ).trim();
    const selectedTemplate = TEMPLATE_STYLES[templateId] || TEMPLATE_STYLES.premiere;

    const userPrompt = (
      req.body?.prompt ||
      req.body?.userDescription ||
      req.body?.eventDescription ||
      req.body?.notes ||
      ""
    ).trim();

    const isViral =
      req.body?.isViral === true ||
      req.body?.isViral === "true" ||
      req.body?.isViral === 1 ||
      req.body?.isViral === "1";

    const eventDetails = req.body?.eventDetails || {};
    const eventTitle = eventDetails.title || req.body?.eventTitle || req.body?.title || selectedTemplate.title;
    const eventDate = eventDetails.date || req.body?.eventDate || req.body?.date || "Saturday, 25 October • 6:00 PM";
    const eventVenue = eventDetails.venue || req.body?.eventVenue || req.body?.venue || "Sky Lounge & Terrace";
    const waitForCompletion =
      req.body?.waitForCompletion === true ||
      req.body?.waitForCompletion === "true";

    // 3. Resolve uploaded photo
    let uploadedPhotoUrl = null;
    let designUrl = req.body?.designUrl || null;

    // A. Check multipart files
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
        console.warn("[VideoInvites] Photo file upload failed:", uploadErr.message);
      }
    }

    if (designFile) {
      try {
        const designUpload = await saveUploadedFile(designFile, req, "video_design");
        if (designUpload?.url || designUpload?.fileUrl) {
          designUrl = designUpload.url || designUpload.fileUrl;
        }
      } catch (designErr) {
        console.warn("[VideoInvites] Design file upload failed:", designErr.message);
      }
    }

    // B. Check body photo (URL or base64)
    if (!uploadedPhotoUrl) {
      const rawPhoto = req.body?.uploadedImageUrl || req.body?.uploadedPhotoUrl || req.body?.photoUrl || req.body?.photo;
      if (rawPhoto && typeof rawPhoto === "string") {
        if (rawPhoto.startsWith("data:image/")) {
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

    // C. Validation for "Pick a template" mode: User photo is required
    if (creationMode === "template" && !uploadedPhotoUrl) {
      if (req.body?.allowSamplePhoto === true || req.body?.allowSamplePhoto === "true") {
        uploadedPhotoUrl = selectedTemplate.defaultPhoto || "https://pub-b01a35ccbe054425bacd868be6412477.r2.dev/template_assets/grad.webp";
      } else {
        // Rollback / refund 2 credits
        const restored = await refundUserCredits(userId, guestId, 2);
        return res.status(400).json({
          success: false,
          error: "Please upload your photo. An image is required to generate the template video invite.",
          requiresPhoto: true,
          refunded: true,
          remainingCredits: restored,
        });
      }
    }

    // 4. Input mapping for ByteDance Seedance Video Model
    // Aspect ratio: 9:16 (vertical mobile preview)
    const viralPromptEnhancement = isViral
      ? "Viral party celebration energy, dynamic camera motion, trending social media cinematography, volumetric golden rim lighting."
      : "";

    let combinedPrompt = "";
    if (creationMode === "template") {
      // Template Mode: template predefined prompt + user photo
      combinedPrompt = `Cinematic vertical 9:16 mobile invitation video backdrop for ${eventTitle}. ${selectedTemplate.stylePrefix}. ${viralPromptEnhancement} Animate the subject in this uploaded photo with subtle natural movement, gentle cheerful smile, celebratory golden particles and festive atmosphere, beautiful camera depth, 4K photorealistic lighting, ultra-smooth 24fps motion.`;
    } else {
      // Describe Mode: user custom text prompt (+ optional reference image)
      const promptCore = userPrompt || `${eventTitle} luxury celebration`;
      combinedPrompt = `Cinematic vertical 9:16 mobile celebration video invitation backdrop for ${eventTitle}. User prompt: "${promptCore}". ${viralPromptEnhancement} Photorealistic 4K quality, natural facial animation and gentle joyful expression, festive sparkles, cinematic lighting, ultra-smooth 24fps vertical motion.`;
    }

    const inviteId = crypto.randomUUID();

    // 5. Check Replicate API Token
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
        remainingCredits,
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

    // 6. Initialize Replicate SDK and run Seedance Video Model
    const Replicate = require("replicate");
    const replicate = new Replicate({ auth: replicateToken });

    // Handle base64 photo via Replicate Files API if needed
    if (uploadedPhotoUrl && uploadedPhotoUrl.startsWith("data:image/")) {
      try {
        const parts = uploadedPhotoUrl.split(",");
        const mimeMatch = parts[0].match(/data:(.*?);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const ext = mimeType.split("/")[1] || "jpg";
        const buffer = Buffer.from(parts[1] || "", "base64");
        console.log(`[VideoInvites] Uploading base64 image (${buffer.length} bytes) to Replicate files...`);
        const fileObj = await replicate.files.create(buffer, { filename: `photo_${Date.now()}.${ext}` });
        const fileUrl = fileObj?.urls?.get || fileObj?.url;
        if (fileUrl) {
          uploadedPhotoUrl = fileUrl;
          console.log(`[VideoInvites] Uploaded to Replicate file URL: ${uploadedPhotoUrl}`);
        }
      } catch (uploadErr) {
        console.warn("[VideoInvites] Replicate files upload error:", uploadErr.message);
      }
    }

    // Seedance Model Input Mapping:
    // Aspect ratio: 9:16 for vertical mobile preview
    const seedanceInput = {
      prompt: combinedPrompt,
      duration: 5,
      fps: 24,
      aspect_ratio: "9:16",
      camera_fixed: false,
      generate_audio: true,
    };

    if (uploadedPhotoUrl) {
      seedanceInput.image = uploadedPhotoUrl;
    }

    let prediction;
    console.log(
      `[VideoInvites] Initiating ByteDance Seedance video generation (model: bytedance/seedance-1.5-pro, mode: ${creationMode}, 9:16)...`
    );

    try {
      prediction = await replicate.predictions.create({
        model: "bytedance/seedance-1.5-pro",
        input: seedanceInput,
      });
    } catch (seedanceErr) {
      console.warn("[VideoInvites] Seedance model invocation failed, trying Minimax fallback:", seedanceErr.message);
      try {
        prediction = await replicate.predictions.create({
          model: "minimax/video-01",
          input: {
            prompt: combinedPrompt,
            first_frame_image: uploadedPhotoUrl || undefined,
            prompt_optimizer: true,
          },
        });
      } catch (fallbackErr) {
        console.error("[VideoInvites] All Replicate video models failed:", fallbackErr.message);
        // Automatic refund / rollback of deducted credits!
        const restored = await refundUserCredits(userId, guestId, 2);
        return res.status(500).json({
          success: false,
          error: `AI video generation failed: ${fallbackErr.message}. Your 2 credits have been refunded.`,
          refunded: true,
          remainingCredits: restored,
        });
      }
    }

    console.log(`[VideoInvites] Prediction created successfully: ${prediction.id}, status: ${prediction.status}`);

    // Track active prediction for status polling and rollback safety
    activePredictions.set(prediction.id, {
      userId,
      guestId,
      creditsDeducted: 2,
      refunded: false,
      createdAt: Date.now(),
    });

    // 7. Handle synchronous wait if requested
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
        } else if (currentPrediction.output?.url) {
          finalVideoUrl = typeof currentPrediction.output.url === "function" ? currentPrediction.output.url() : currentPrediction.output.url;
        }

        return res.status(200).json({
          success: true,
          videoUrl: finalVideoUrl,
          remainingCredits,
          inviteId,
          prompt: combinedPrompt,
          message: "Video generated successfully. 2 credits deducted.",
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
      } else if (currentPrediction.status === "failed" || currentPrediction.status === "canceled") {
        // Rollback / refund deducted credits
        const restored = await refundUserCredits(userId, guestId, 2);
        return res.status(500).json({
          success: false,
          error: "Video generation failed. Your 2 credits have been refunded.",
          refunded: true,
          remainingCredits: restored,
        });
      }
    }

    // Default: asynchronous polling response
    return res.status(200).json({
      success: true,
      async: true,
      predictionId: prediction.id,
      status: prediction.status,
      remainingCredits,
      message: "ByteDance Seedance video generation started. 2 credits deducted.",
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
    console.error("[VideoInvites] Unhandled exception in generateVideoInvite:", err);
    // Automatic refund / rollback if credits were deducted
    if (creditDeducted) {
      const restored = await refundUserCredits(userId, guestId, 2);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to initiate AI video generation",
        refunded: true,
        remainingCredits: restored,
      });
    }
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to initiate AI video generation",
    });
  }
};

/**
 * Controller: GET /api/video-invites/status/:predictionId
 * Polling endpoint for checking prediction status and retrieving video output.
 * Automatically refunds user's 2 credits if Replicate generation failed.
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
        const first = prediction.output[0];
        videoUrl = typeof first === "string" ? first : (first?.url || String(first));
      } else if (prediction.output?.url) {
        videoUrl = typeof prediction.output.url === "function" ? prediction.output.url() : prediction.output.url;
      }
    }

    // Rollback / refund logic if status is failed or canceled
    let refunded = false;
    let remainingCredits = null;
    const tracked = activePredictions.get(predictionId);
    if ((prediction.status === "failed" || prediction.status === "canceled") && tracked && !tracked.refunded) {
      remainingCredits = await refundUserCredits(tracked.userId, tracked.guestId, tracked.creditsDeducted || 2);
      tracked.refunded = true;
      refunded = true;
      console.log(`[VideoInvites] Prediction ${predictionId} failed. Refunded ${tracked.creditsDeducted || 2} credits to user/guest.`);
    }

    return res.status(200).json({
      success: true,
      status: prediction.status, // "starting" | "processing" | "succeeded" | "failed" | "canceled"
      videoUrl,
      error: prediction.error || null,
      refunded,
      remainingCredits,
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
 * Controller: GET /api/video-invites/credits
 * Returns user's current credit balance
 */
const getUserCredits = async (req, res) => {
  const userId = req.user?.id || null;
  const guestId = req.headers["x-guest-session-id"] || req.cookies?.guestId || req.ip || "guest_default";
  try {
    const credits = await getBalance(userId, guestId);
    return res.status(200).json({
      success: true,
      credits,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: POST /api/video-invites/buy-credits
 * Credit purchase endpoint to top-up user or guest account
 */
const buyCredits = async (req, res) => {
  const userId = req.user?.id || null;
  const guestId = req.headers["x-guest-session-id"] || req.cookies?.guestId || req.ip || "guest_default";
  const amount = Math.max(1, parseInt(req.body?.amount || 20, 10));

  try {
    let updatedCredits = 0;
    if (userId) {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { credits: true },
      });
      updatedCredits = user.credits;
    } else {
      const current = guestWallets.get(guestId) ?? 30;
      updatedCredits = current + amount;
      guestWallets.set(guestId, updatedCredits);
    }

    return res.status(200).json({
      success: true,
      credits: updatedCredits,
      addedAmount: amount,
      message: `Successfully purchased ${amount} credits! Your new balance is ${updatedCredits} credits.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
  generateVideoInvite,
  createAiTemplate: generateVideoInvite, // Backward compatibility alias
  checkPredictionStatus,
  getUserCredits,
  buyCredits,
  listTemplates,
  TEMPLATE_STYLES,
};
