const express = require("express");
const router = express.Router();
const guestController = require("../controllers/guest.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { restrictGuest } = authMiddleware;

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Guest Portal endpoints (Accessible to authenticated GUEST accounts)
router.get("/me/portal", guestController.getMyGuestPortal);
router.post("/me/rsvp", guestController.submitGuestRsvp);
router.post("/me/check-in", guestController.selfCheckInGuest);
router.post("/me/gallery", guestController.uploadGuestGalleryPhoto);

// Host Guest management routes (Restricted from GUEST role)
router.get("/", guestController.getGuests);
router.post("/import/csv", restrictGuest, guestController.importGuestsFromCSV);

// Group routes (must be defined before /:id to prevent parameter capture)
router.get("/groups", guestController.getGroups);
router.post("/groups", restrictGuest, guestController.createGroup);
router.delete("/groups/:name", restrictGuest, guestController.deleteGroup);
router.put("/groups/:name/members", restrictGuest, guestController.updateGroupMembers);

// Individual guest routes
router.get("/:id", guestController.getGuestById);
router.post("/", restrictGuest, guestController.createGuest);
router.put("/:id", restrictGuest, guestController.updateGuest);
router.delete("/:id", restrictGuest, guestController.deleteGuest);

// Attendance Guarantee fee actions
router.post("/:id/waive-guarantee", restrictGuest, guestController.waiveGuarantee);
router.post("/:id/charge-guarantee", restrictGuest, guestController.chargeGuarantee);

module.exports = router;

