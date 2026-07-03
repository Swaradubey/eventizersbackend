const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// User Message routes
router.get("/", messageController.getMessages);
router.get("/stats", messageController.getStats);
router.get("/:id", messageController.getMessageById);
router.post("/", messageController.createMessage);
router.delete("/:id", messageController.deleteMessage);

module.exports = router;
