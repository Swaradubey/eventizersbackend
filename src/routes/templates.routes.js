const express = require('express');
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const authenticate = authMiddleware;
const isAdmin = authMiddleware.requireAdmin;

const router = express.Router();

const { newTemplatesDataBackend } = require('../config/newTemplatesBackend');
const { saveUploadedFile, saveBase64Image, saveRemoteImage } = require('../utils/fileStorage');

// Get all templates

// Helper to format relative asset paths into absolute URLs for mobile apps and external consumers
const makeAbsoluteUrl = (url, req) => {
  if (!url || typeof url !== 'string') return url || null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  // If already an absolute URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If running in production but the stored URL points to localhost, fix it dynamically
    if (isProduction && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      const publicBase =
        process.env.BACKEND_PUBLIC_URL ||
        process.env.BACKEND_URL ||
        process.env.PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        (req ? `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.get('host')}` : '');
      const cleanPublicBase = publicBase ? publicBase.replace(/\/api\/?$/i, '').replace(/\/+$/, '') : '';
      const pathOnly = trimmed.replace(/^https?:\/\/[^/]+/, '');
      if (cleanPublicBase && !cleanPublicBase.includes('localhost')) {
        return `${cleanPublicBase}${pathOnly.startsWith('/') ? '' : '/'}${pathOnly}`;
      }
      return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    }
    return trimmed;
  }

  // Determine appropriate base URL:
  // For frontend assets (/assets/, /templates/), prioritize FRONTEND_URL if set; otherwise use backend public URL
  const isFrontendAsset = trimmed.startsWith('/assets') || trimmed.startsWith('/templates') || trimmed.startsWith('assets/') || trimmed.startsWith('templates/');
  const frontendCandidate = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  let baseUrl = '';
  if (isFrontendAsset && frontendCandidate && !frontendCandidate.includes('localhost')) {
    baseUrl = frontendCandidate.replace(/\/+$/, '');
  } else {
    const envCandidate =
      process.env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL;
    baseUrl = envCandidate ? envCandidate.replace(/\/api\/?$/i, '').replace(/\/+$/, '') : '';
  }

  if (!baseUrl && req) {
    try {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const protocol = forwardedProto || req.protocol || (isProduction ? 'https' : 'http');
      const host = req.get('host');
      if (host && !(isProduction && (host.startsWith('localhost') || host.startsWith('127.0.0.1')))) {
        baseUrl = `${protocol}://${host}`;
      }
    } catch (_) {}
  }

  // In production, NEVER fall back to localhost!
  // Return clean relative path if no valid public hostname is configured
  if (!baseUrl || (isProduction && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')))) {
    if (isProduction) {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
    baseUrl = 'http://localhost:5000';
  }

  return `${baseUrl.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`;
};

// Format template with dual URLs (relative for web, absolute for mobile)
const formatTemplateForClient = (t, req) => {
  let contentObj = {};
  try {
    contentObj = typeof t.content === 'string' ? JSON.parse(t.content) : (t.content || {});
  } catch (_) {}

  const rawThumb = contentObj.thumbnailUrl || contentObj.imageUrl || t.thumbnailUrl || null;
  const rawImage = contentObj.imageUrl || t.imageUrl || null;
  const rawBgImage = contentObj.backgroundImage || contentObj.backgroundUrl || (contentObj.card && contentObj.card.artworkUrl) || (contentObj.canvasData && contentObj.canvasData.backgroundImage) || rawImage;

  const cardObj = contentObj.card || t.card || null;
  const formattedCard = cardObj ? {
    ...cardObj,
    artworkUrl: cardObj.artworkUrl || rawBgImage || null,
    fullArtworkUrl: makeAbsoluteUrl(cardObj.artworkUrl || rawBgImage, req),
    backgroundColor: cardObj.backgroundColor || "#ffffff",
    aspectRatio: cardObj.aspectRatio || "5x7",
  } : (rawBgImage ? {
    artworkUrl: rawBgImage,
    fullArtworkUrl: makeAbsoluteUrl(rawBgImage, req),
    backgroundColor: "#ffffff",
    aspectRatio: "5x7",
  } : null);

  const backdropObj = contentObj.backdrop || t.backdrop || null;
  const formattedBackdrop = backdropObj ? {
    ...backdropObj,
    fullValue: backdropObj.type === "texture" ? makeAbsoluteUrl(backdropObj.value, req) : backdropObj.value,
  } : null;

  const envelopeObj = contentObj.envelope || t.envelope || null;
  const formattedEnvelope = envelopeObj ? {
    ...envelopeObj,
    fullLinerPatternUrl: envelopeObj.linerPatternUrl ? makeAbsoluteUrl(envelopeObj.linerPatternUrl, req) : undefined,
  } : null;

  const resolvedLayers = contentObj.defaultTextLayers || t.defaultTextLayers || (contentObj.canvasData && contentObj.canvasData.layers) || [];

  return {
    id: t.id,
    name: t.name || t.title || "Invitation Template",
    title: t.title || t.name || "Invitation Template",
    category: t.category || "General",
    tags: contentObj.tags || t.tags || [],
    isPremium: Boolean(t.isPremium),
    badge: contentObj.badge || (t.isPremium ? "Premium" : "Free"),
    thumbnailUrl: rawThumb,
    fullThumbnailUrl: makeAbsoluteUrl(rawThumb, req),
    imageUrl: rawImage,
    fullImageUrl: makeAbsoluteUrl(rawImage, req),
    coverImage: rawImage,
    fullCoverImage: makeAbsoluteUrl(rawImage, req),
    backgroundImage: rawBgImage,
    fullBackgroundImage: makeAbsoluteUrl(rawBgImage, req),
    backgroundUrl: rawBgImage,
    canvasData: contentObj.canvasData || {
      backgroundImage: rawBgImage,
      layers: resolvedLayers,
    },
    backdrop: formattedBackdrop,
    envelope: formattedEnvelope,
    card: formattedCard,
    defaultTextLayers: resolvedLayers,
    // Signals the client that this template carries admin-authored text layers
    // that must be rendered on top of the raw background image.
    isLayered: Boolean(contentObj.isLayered),
    emoji: contentObj.emoji || t.emoji || null,
    gradient: contentObj.gradient || null,
    accentColor: contentObj.accentColor || null,
    host: contentObj.host || null,
    venue: contentObj.venue || null,
    description: contentObj.description || null,
    textElements: contentObj.textElements || t.textElements || [],
    content: t.content,
    htmlContent: t.content,
  };
};

// Get all templates
router.get('/', async (req, res, next) => {
  try {
    let dbTemplates = [];
    try {
      if (prisma && prisma.template) {
        dbTemplates = await prisma.template.findMany({
          orderBy: { createdAt: 'desc' }
        });
      }
    } catch (dbErr) {
      console.warn("[TemplatesRoutes] DB query for templates failed, using fallback:", dbErr.message);
    }

    const fallbackFormatted = (newTemplatesDataBackend || []).map((t) => formatTemplateForClient(t, req));
    
    // Combine db templates (if any) with fallback templates, deduplicating by ID (case-insensitive)
    if (dbTemplates && dbTemplates.length > 0) {
      const dbFormatted = dbTemplates.map((t) => formatTemplateForClient(t, req));
      const combined = [...dbFormatted];
      const seenIds = new Set(dbFormatted.map(t => String(t.id).toLowerCase()));
      for (const t of fallbackFormatted) {
        if (!seenIds.has(String(t.id).toLowerCase())) {
          combined.push(t);
        }
      }
      return res.json(combined);
    }

    return res.json(fallbackFormatted);
  } catch (err) {
    next(err);
  }
});

// Get single template by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: "Template ID parameter is required" });
    }
    const cleanId = String(id).trim().toLowerCase();

    // 1. Try finding in DB first with case-insensitive support
    if (prisma && prisma.template) {
      try {
        let dbTpl = await prisma.template.findUnique({ where: { id } });
        if (!dbTpl && id.toLowerCase() !== id) {
          dbTpl = await prisma.template.findUnique({ where: { id: id.toLowerCase() } });
        }
        if (!dbTpl) {
          dbTpl = await prisma.template.findFirst({
            where: {
              OR: [
                { id: { equals: id, mode: 'insensitive' } },
                { id: { equals: cleanId, mode: 'insensitive' } },
              ]
            }
          });
        }
        if (dbTpl) {
          return res.json(formatTemplateForClient(dbTpl, req));
        }
      } catch (dbErr) {
        console.error(`[TemplatesRoutes] Database query error for template '${id}':`, dbErr.message);
        // Before failing with 500, check if the fallback list contains this template
        const fallbackList = (newTemplatesDataBackend || []).map((t) => formatTemplateForClient(t, req));
        const matchedFallback = fallbackList.find(t => 
          t.id.toLowerCase() === cleanId || 
          t.id.toLowerCase().replace(/-/g, '') === cleanId.replace(/-/g, '')
        );
        if (matchedFallback) {
          return res.json(matchedFallback);
        }
        return res.status(500).json({
          error: "Database error while fetching template",
          details: dbErr.message
        });
      }
    }

    // 2. Find in predefined backend templates
    const fallbackList = (newTemplatesDataBackend || []).map((t) => formatTemplateForClient(t, req));
    const matched = fallbackList.find(t => 
      t.id.toLowerCase() === cleanId || 
      t.id.toLowerCase().replace(/-/g, '') === cleanId.replace(/-/g, '')
    );

    if (matched) {
      return res.json(matched);
    }

    return res.status(404).json({ error: `Template with ID '${id}' not found` });
  } catch (err) {
    next(err);
  }
});

// Create a template (Admin only)
router.post('/', authenticate, isAdmin, async (req, res, next) => {
  try {
    const {
      name,
      title,
      category = "General",
      badge = "Free",
      isPremium = false,
      imageUrl,
      thumbnailUrl,
      backgroundUrl,
      backgroundImage,
      canvasData,
      tags = [],
      aspectRatio = "5x7",
      backgroundColor = "#ffffff",
      description = "",
      defaultTextLayers,
      layers,
      isLayered,
    } = req.body;

    const templateName = (title || name || "New Template").trim();
    // backgroundImage/backgroundUrl takes priority over imageUrl/thumbnailUrl for layered templates
    let finalImage = (backgroundImage || backgroundUrl || (canvasData && canvasData.backgroundImage) || imageUrl || thumbnailUrl || "").trim();

    // If an external web image URL was provided, automatically download and cache it locally
    // to prevent cross-origin blocking, hotlinking 403s, and ensure it always loads!
    if (finalImage.startsWith("http://") || finalImage.startsWith("https://")) {
      try {
        const savedRemote = await saveRemoteImage(finalImage, req, "template_artwork");
        if (savedRemote && (savedRemote.url || savedRemote.fileUrl)) {
          finalImage = savedRemote.url || savedRemote.fileUrl;
        }
      } catch (dlErr) {
        console.warn("[TemplatesRoutes] Could not cache remote image locally:", dlErr.message);
        if (dlErr.isWebpage) {
          return res.status(400).json({
            error: dlErr.message || "The link provided points to a webpage, not a direct image."
          });
        }
      }
    }

    // Generate clean slug-based ID
    const baseSlug = templateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const cleanId = `tpl-${baseSlug || 'custom'}-${Date.now().toString().slice(-4)}`;

    const effectiveIsPremium = Boolean(isPremium || badge?.toLowerCase() === "premium");
    const effectiveBadge = badge || (effectiveIsPremium ? "Premium" : "Free");

    // Resolve final text layers: use admin-authored layers when provided, else generate defaults
    const adminLayers = Array.isArray(defaultTextLayers) && defaultTextLayers.length > 0
      ? defaultTextLayers
      : Array.isArray(layers) && layers.length > 0
        ? layers
        : (canvasData && Array.isArray(canvasData.layers) && canvasData.layers.length > 0 ? canvasData.layers : null);

    const resolvedTextLayers = adminLayers || [
      {
        id: "layer-title",
        key: "title",
        text: templateName,
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 22,
        color: "#1A1A1A",
        fontWeight: "600",
        textAlign: "center",
        top: 65,
        left: 50
      },
      {
        id: "layer-datetime",
        key: "datetime",
        text: "Saturday, November 14 • 6:00 PM",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        color: "#4A4A4A",
        fontWeight: "400",
        textAlign: "center",
        top: 76,
        left: 50
      },
      {
        id: "layer-venue",
        key: "venue",
        text: "The Grand Plaza • City Center",
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
        color: "#7A7A7A",
        fontWeight: "400",
        textAlign: "center",
        top: 84,
        left: 50
      }
    ];

    // Standardized content payload expected by client/designer
    const contentObj = {
      badge: effectiveBadge,
      thumbnailUrl: finalImage,
      imageUrl: finalImage,
      backgroundUrl: finalImage,
      backgroundImage: finalImage,
      canvasData: canvasData || {
        backgroundImage: finalImage,
        layers: resolvedTextLayers,
      },
      category: category || "General",
      tags: Array.isArray(tags) && tags.length > 0 ? tags : [category || "General"],
      description: description || "",
      // isLayered = true signals the client to treat this as a new layered template
      isLayered: Boolean(isLayered || adminLayers),
      backdrop: {
        type: "color",
        value: "#FAF8F5",
        color: "#FAF8F5",
        gradient: "linear-gradient(135deg, #FAF8F5 0%, #EDE9E1 100%)"
      },
      envelope: {
        outerColor: "#F3F0EB",
        flapColor: "#EAE5DC",
        linerColor: "#DFD8CD",
        linerCss: "linear-gradient(135deg, #EAE5DC 0%, #DFD8CD 100%)",
        isOpen: true,
        isOpenUpward: true
      },
      card: {
        backgroundColor: backgroundColor || "#FFFFFF",
        artworkUrl: finalImage,
        aspectRatio: aspectRatio || "5x7"
      },
      defaultTextLayers: resolvedTextLayers
    };

    const template = await prisma.template.create({
      data: {
        id: cleanId,
        name: templateName,
        category: category || "General",
        isPremium: effectiveIsPremium,
        content: JSON.stringify(contentObj),
      }
    });

    const formatted = formatTemplateForClient(template, req);
    res.status(201).json({
      success: true,
      message: "Template created successfully",
      template: formatted
    });
  } catch (err) {
    next(err);
  }
});

// Delete a template (Admin only)
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.template.delete({
      where: { id }
    });
    res.json({ success: true, message: `Template '${id}' deleted successfully` });
  } catch (err) {
    next(err);
  }
});

const multer = require('multer');

// Multer configuration using memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Resolve, validate and pre-cache a remote image link for real-time live preview
router.post('/resolve-image', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: "Please provide an image URL" });
    }

    const savedRemote = await saveRemoteImage(url.trim(), req, "template_preview");
    return res.json({
      success: true,
      url: savedRemote.url || savedRemote.fileUrl,
      fileUrl: savedRemote.fileUrl,
      filename: savedRemote.filename
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to load image from the provided link"
    });
  }
});

// Upload a template file or canvas snapshot
router.post('/upload', authenticate, upload.any(), async (req, res, next) => {
  try {
    // 1. Check if multipart file uploaded
    const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : req.file;

    if (uploadedFile) {
      const result = await saveUploadedFile(uploadedFile, req, 'template');
      return res.status(201).json({
        success: true,
        message: 'Template uploaded successfully',
        url: result.url,
        fileUrl: result.fileUrl,
        filename: result.filename,
      });
    }

    // 2. Check if base64 passed in json body (e.g. { file: "data:image/...", image: "..." })
    const base64Input = req.body?.file || req.body?.image || req.body?.coverImage || req.body?.templateFile || req.body?.snapshot;
    if (base64Input) {
      const result = await saveBase64Image(base64Input, req, 'snapshot');
      if (result) {
        return res.status(201).json({
          success: true,
          message: 'Template snapshot uploaded successfully',
          url: result.url,
          fileUrl: result.fileUrl,
          filename: result.filename,
        });
      }
    }

    return res.status(400).json({ error: 'Please upload a file or provide an image payload' });
  } catch (err) {
    next(err);
  }
});

// Preflight for proxy-image
router.options('/proxy-image', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendStatus(204);
});

// Lightweight proxy endpoint for external template image links to bypass CORS restrictions
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url parameter');
    }
    const decodedUrl = decodeURIComponent(url);
    if (!/^https?:\/\//i.test(decodedUrl)) {
      return res.status(400).send('Invalid url protocol');
    }

    const https = require('https');
    const http = require('http');
    const client = decodedUrl.startsWith('https') ? https : http;

    const proxyReq = client.get(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      timeout: 15000,
    }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect(proxyRes.headers.location);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy-image] Request error:', err.message);
      if (!res.headersSent) {
        res.status(502).send('Error fetching remote image');
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
});

module.exports = router;

