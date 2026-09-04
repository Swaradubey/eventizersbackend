const express = require("express");
const router = express.Router();
const guestController = require("../controllers/guest.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Guest routes
router.get("/", guestController.getGuests);
router.post("/import/csv", guestController.importGuestsFromCSV);

// Group routes (must be defined before /:id to prevent parameter capture)
router.get("/groups", guestController.getGroups);
router.post("/groups", guestController.createGroup);
router.delete("/groups/:name", guestController.deleteGroup);
router.put("/groups/:name/members", guestController.updateGroupMembers);

// Individual guest routes
router.get("/:id", guestController.getGuestById);
router.post("/", guestController.createGuest);
router.put("/:id", guestController.updateGuest);
router.delete("/:id", guestController.deleteGuest);

module.exports = router;
