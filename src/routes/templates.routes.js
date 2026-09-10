const express = require('express');
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const authenticate = authMiddleware;
const isAdmin = authMiddleware.requireAdmin;

const router = express.Router();

const { newTemplatesDataBackend } = require('../config/newTemplatesBackend');

// ─── Helper: format a raw template record into the API response shape ─────────
const formatTemplate = (t) => {
  const newTplMatch = (newTemplatesDataBackend || []).find(nt => nt.id === t.id);
  let newTplContent = {};
  if (newTplMatch) {
    try {
      newTplContent = typeof newTplMatch.content === 'string' ? JSON.parse(newTplMatch.content) : (newTplMatch.content || {});
    } catch (_) { }
  }

  let contentObj = {};
  try {
    contentObj = typeof t.content === 'string' ? JSON.parse(t.content) : (t.content || {});
  } catch (_) { }

  // Prioritize standardized 4-layer Evite decoupled data from newTemplatesDataBackend if present
  contentObj = { ...contentObj, ...newTplContent };

  return {
    id: t.id,
    name: newTplMatch?.name || t.name,
    category: newTplMatch?.category || t.category,
    tags: t.tags || (t.category ? [t.category, 'All'] : ['All']),
    isPremium: t.isPremium || false,
    thumbnailUrl: contentObj.imageUrl || t.thumbnailUrl || null,
    imageUrl: contentObj.imageUrl || null,
    coverImage: contentObj.imageUrl || null,
    decorationImage: contentObj.decorationImage || (contentObj.imageUrl && contentObj.imageUrl.endsWith('.svg') && !contentObj.imageUrl.endsWith('-bg.svg') ? contentObj.imageUrl.replace('.svg', '-bg.svg') : null),
    emoji: contentObj.emoji || null,
    gradient: contentObj.gradient || null,
    accentColor: contentObj.accentColor || null,
    backgroundColor: contentObj.backgroundColor || null,
    textColor: contentObj.textColor || null,
    fontFamily: contentObj.fontFamily || null,
    fontWeight: contentObj.fontWeight || null,
    titleSize: contentObj.titleSize || null,
    buttonColor: contentObj.buttonColor || null,
    buttonRadius: contentObj.buttonRadius ?? null,
    textAlignment: contentObj.textAlignment || null,
    host: contentObj.host || null,
    venue: contentObj.venue || null,
    description: contentObj.description || null,
    textLayers: t.textLayers || contentObj.textLayers || null,
    photoSlot: t.photoSlot || contentObj.photoSlot || null,
    // 4-Layer Evite Decoupled Schema Properties
    backdrop: contentObj.backdrop || {
      type: 'color',
      value: contentObj.gradient || contentObj.backgroundColor || '#1e293b',
    },
    envelope: contentObj.envelope || {
      outerColor: contentObj.envelopeColor || contentObj.accentColor || '#781d60',
      linerPatternUrl: contentObj.envelopeLiner || 'gold-foil',
      isOpen: true,
    },
    card: contentObj.card || {
      artworkUrl: contentObj.decorationImage || (contentObj.imageUrl && contentObj.imageUrl.endsWith('.svg') && !contentObj.imageUrl.endsWith('-bg.svg') ? contentObj.imageUrl.replace('.svg', '-bg.svg') : contentObj.imageUrl),
      backgroundColor: contentObj.backgroundColor || '#ffffff',
      aspectRatio: '5x7',
    },
    defaultTextLayers: contentObj.defaultTextLayers || (contentObj.textLayers ? contentObj.textLayers.map(l => ({
      id: l.id,
      key: l.key || l.id.replace(/^layer-/, ''),
      text: l.text,
      fontFamily: l.fontFamily,
      fontSize: l.fontSize,
      color: l.color,
      fontWeight: l.fontWeight,
      textAlign: l.align || l.textAlign || 'center',
      top: l.top !== undefined ? l.top : (l.y !== undefined ? l.y : 50),
      left: l.left !== undefined ? l.left : (l.x !== undefined ? l.x : 50),
    })) : []),
    content: t.content,
    htmlContent: t.content,
  };
};

// ─── Helper: check if a template is corporate ─────────────────────────────────
const isCorporate = (t) => {
  const cat = (t.category || '').toLowerCase();
  const id = (t.id || '').toLowerCase();
  const name = (t.name || '').toLowerCase();
  return cat.includes('corp') || id.includes('corp') || id.includes('executive') || name.includes('corporate') || cat.includes('business');
};

// ─── Helper: build merged list of all templates ───────────────────────────────
const getMergedTemplates = async () => {
  let dbTemplates = [];
  try {
    dbTemplates = await prisma.template.findMany();
  } catch (dbErr) {
    console.warn("DB query for templates failed, using fallback:", dbErr.message);
  }

  const newTemplatesFormatted = (newTemplatesDataBackend || []).map(formatTemplate);

  let merged = [];
  if (dbTemplates && dbTemplates.length > 0) {
    const dbMap = {};
    for (const t of dbTemplates) {
      dbMap[t.id] = t;
    }
    const mergedIds = new Set(Object.keys(dbMap));
    const extraNew = newTemplatesFormatted.filter(t => !mergedIds.has(t.id));
    merged = [...dbTemplates.map(formatTemplate), ...extraNew];
  } else {
    merged = newTemplatesFormatted;
  }

  // Strictly exclude any corporate templates
  return merged.filter(t => !isCorporate(t));
};

router.get('/categories', async (req, res, next) => {
  try {
    const all = await getMergedTemplates();
    const counts = {};
    for (const t of all) {
      const cat = t.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const categories = Object.entries(counts).map(([name, count]) => ({ name, count }));
    // Prepend an "All" entry with the total count
    categories.unshift({ name: 'All', count: all.length });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/templates
//   Returns all templates.
//   Optional query params:
//     ?category=Baby+Shower   → filter by category (case-insensitive)
//     ?tag=Baby+Shower        → filter by tag
//     ?premium=true|false     → filter by isPremium
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    let templates = await getMergedTemplates();

    // Category filter (matches category field, case-insensitive)
    const { category, tag, premium } = req.query;
    if (category && category.toLowerCase() !== 'all') {
      templates = templates.filter(t =>
        (t.category || '').toLowerCase() === category.toLowerCase()
      );
    }

    // Tag filter (matches any element in the tags array)
    if (tag && tag.toLowerCase() !== 'all') {
      templates = templates.filter(t =>
        (t.tags || []).some(tg => tg.toLowerCase() === tag.toLowerCase())
      );
    }

    // Premium filter
    if (premium !== undefined) {
      const wantPremium = premium === 'true' || premium === '1';
      templates = templates.filter(t => !!t.isPremium === wantPremium);
    }

    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/templates/:id
//   Returns a single template by its ID.
//   Returns 404 if not found.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try DB first
    let template = null;
    try {
      template = await prisma.template.findUnique({ where: { id } });
    } catch (dbErr) {
      console.warn("DB lookup failed, trying local fallback:", dbErr.message);
    }

    // Fallback to newTemplatesBackend
    if (!template) {
      template = (newTemplatesDataBackend || []).find(t => t.id === id) || null;
    }

    if (!template || isCorporate(template)) {
      return res.status(404).json({ error: `Template '${id}' not found.` });
    }

    res.json(formatTemplate(template));
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
