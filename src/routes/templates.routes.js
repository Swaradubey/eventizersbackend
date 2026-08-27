const express = require('express');
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const authenticate = authMiddleware;
const isAdmin = authMiddleware.requireAdmin;

const router = express.Router();

// Get all templates
router.get('/', async (req, res, next) => {
  try {
    let dbTemplates = [];
    try {
      dbTemplates = await prisma.template.findMany();
    } catch (dbErr) {
      console.warn("DB query for templates failed, using fallback:", dbErr.message);
    }
    res.json(dbTemplates);
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
