const express = require("express");
const router = express.Router();
const registryController = require("../controllers/registry.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes in this router with authMiddleware
router.use(authMiddleware);

// Get registry summary
router.get("/summary", registryController.getRegistrySummary);

// Get registries list for selected event
router.get("/", registryController.getRegistries);

// Get a specific registry details
router.get("/:id", registryController.getRegistryById);

// Create a new registry
router.post("/", registryController.createRegistry);

// Update a registry (support PUT or PATCH style updates)
router.put("/:id", registryController.updateRegistry);

// Delete a registry
router.delete("/:id", registryController.deleteRegistry);

module.exports = router;
