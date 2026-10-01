const express = require('express');
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const authenticate = authMiddleware;
const isAdmin = authMiddleware.requireAdmin;

const router = express.Router();

const { newTemplatesDataBackend } = require('../config/newTemplatesBackend');

// Get all templates

// Helper to format relative asset paths into absolute URLs for mobile apps
const makeAbsoluteUrl = (url, req) => {
  if (!url || typeof url !== 'string') return url || null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    return `${protocol}://${host}${url.startsWith('/') ? '' : '/'}${url}`;
  } catch (_) {
    return url;
  }
};

// Format template with dual URLs (relative for web, absolute for mobile)
const formatTemplateForClient = (t, req) => {
  let contentObj = {};
  try {
    contentObj = typeof t.content === 'string' ? JSON.parse(t.content) : (t.content || {});
  } catch (_) {}

  const rawThumb = contentObj.thumbnailUrl || contentObj.imageUrl || t.thumbnailUrl || null;
  const rawImage = contentObj.imageUrl || t.imageUrl || null;

  const cardObj = contentObj.card || t.card || null;
  const formattedCard = cardObj ? {
    ...cardObj,
    artworkUrl: cardObj.artworkUrl || null,
    fullArtworkUrl: makeAbsoluteUrl(cardObj.artworkUrl, req),
    backgroundColor: cardObj.backgroundColor || "#ffffff",
    aspectRatio: cardObj.aspectRatio || "5x7",
  } : null;

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
    backdrop: formattedBackdrop,
    envelope: formattedEnvelope,
    card: formattedCard,
    defaultTextLayers: contentObj.defaultTextLayers || t.defaultTextLayers || [],
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
        dbTemplates = await prisma.template.findMany();
      }
    } catch (dbErr) {
      console.warn("DB query for templates failed, using fallback:", dbErr.message);
    }

    const fallbackFormatted = (newTemplatesDataBackend || []).map((t) => formatTemplateForClient(t, req));
    
    // Combine db templates (if any) with fallback templates
    if (dbTemplates && dbTemplates.length > 0) {
      const dbFormatted = dbTemplates.map((t) => formatTemplateForClient(t, req));
      const combined = [...dbFormatted];
      const seenIds = new Set(dbFormatted.map(t => t.id));
      for (const t of fallbackFormatted) {
        if (!seenIds.has(t.id)) {
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
    const cleanId = String(id).trim().toLowerCase();

    // Try finding in DB first
    try {
      if (prisma && prisma.template) {
        const dbTpl = await prisma.template.findUnique({ where: { id } });
        if (dbTpl) {
          return res.json(formatTemplateForClient(dbTpl, req));
        }
      }
    } catch (_) {}

    // Find in predefined backend templates
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
    const { name, thumbnailUrl, htmlContent, price } = req.body;
    const template = await prisma.template.create({
      data: { name, thumbnailUrl, htmlContent, price }
    });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

const multer = require('multer');
const { saveUploadedFile, saveBase64Image } = require('../utils/fileStorage');

// Multer configuration using memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
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

module.exports = router;
