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
const path = require('path');
const fs = require('fs');
const os = require('os');

// Serverless-safe Multer configuration using memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Upload a template file
router.post('/upload', authenticate, upload.single('templateFile'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }
    
    // In serverless / Vercel, convert buffer to data URL or save to /tmp if needed
    const mimeType = req.file.mimetype || 'image/png';
    const base64Data = req.file.buffer.toString('base64');
    const fileUrl = `data:${mimeType};base64,${base64Data}`;
    
    res.status(201).json({
      success: true,
      message: 'Template uploaded successfully',
      fileUrl: fileUrl
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
