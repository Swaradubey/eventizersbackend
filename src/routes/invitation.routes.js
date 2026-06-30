const express = require("express");
const router = express.Router();
const invitationController = require("../controllers/invitation.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Send to guests endpoint (must be before /:id to avoid route conflict)
router.post("/send", invitationController.sendInvitationToGuests);

// Invitation endpoints
router.get("/", invitationController.getInvitations);
router.get("/:id", invitationController.getInvitationById);
router.post("/", invitationController.createInvitation);
router.put("/:id", invitationController.updateInvitation);
router.delete("/:id", invitationController.deleteInvitation);

// Send specific invitation
router.post("/:id/send", invitationController.sendInvitation);

module.exports = router;
