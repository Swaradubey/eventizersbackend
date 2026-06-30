const express = require("express");
const router = express.Router();
const guestController = require("../controllers/guest.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Guest routes
router.get("/", guestController.getGuests);
router.get("/:id", guestController.getGuestById);
router.post("/", guestController.createGuest);
router.put("/:id", guestController.updateGuest);
router.delete("/:id", guestController.deleteGuest);
router.post("/import/csv", guestController.importGuestsFromCSV);

module.exports = router;
