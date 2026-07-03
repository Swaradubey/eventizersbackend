const registryService = require("../services/registry.service");
const eventService = require("../services/event.service");

// Helper to convert Decimal fields to number for JSON response
const serializeRegistry = (registry) => {
  if (!registry) return null;
  return {
    ...registry,
    goalAmount: registry.goalAmount !== null && registry.goalAmount !== undefined ? Number(registry.goalAmount) : null,
    currentAmount: registry.currentAmount !== null && registry.currentAmount !== undefined ? Number(registry.currentAmount) : 0,
  };
};

/**
 * Validate HTTP/HTTPS URLs
 */
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

/**
 * Get registries for the selected event
 * GET /api/registries?eventId=:eventId
 */
const getRegistries = async (req, res) => {
  try {
    const { eventId } = req.query;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ error: "eventId is required." });
    }

    // Verify event ownership
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(403).json({ error: "Access Denied. You do not own this event." });
    }

    const registries = await registryService.findRegistriesByEventId(eventId, userId);
    const serialized = registries.map(serializeRegistry);

    return res.status(200).json({
      success: true,
      registries: serialized,
    });
  } catch (error) {
    console.error("Get Registries Error:", error);
    return res.status(500).json({ error: "Server error retrieving registries." });
  }
};

/**
 * Get a specific registry by ID
 * GET /api/registries/:id
 */
const getRegistryById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: "id parameter is required." });
    }

    const registry = await registryService.findRegistryById(id);
    if (!registry) {
      return res.status(404).json({ error: "Registry not found." });
    }

    // Verify ownership of the related event
    if (registry.event.createdBy !== userId) {
      return res.status(403).json({ error: "Access Denied. You do not own the related event." });
    }

    // Clean event from response
    const { event, ...registryData } = registry;

    return res.status(200).json({
      success: true,
      registry: serializeRegistry(registryData),
    });
  } catch (error) {
    console.error("Get Registry By ID Error:", error);
    return res.status(500).json({ error: "Server error retrieving registry details." });
  }
};

/**
 * Create a registry
 * POST /api/registries
 */
const createRegistry = async (req, res) => {
  try {
    const { eventId, type, title, description, goalAmount, currency, externalUrl, isActive } = req.body;
    const userId = req.user.id;

    // Validation
    if (!eventId) {
      return res.status(400).json({ error: "eventId is required." });
    }
    if (!type) {
      return res.status(400).json({ error: "Registry type is required." });
    }
    const validTypes = ["CASH_FUND", "GIFT_REGISTRY", "DONATION", "EXTERNAL_LINK"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid registry type: ${type}.` });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required and cannot be empty." });
    }

    // Goal amount check
    if (goalAmount !== undefined && goalAmount !== null) {
      const numGoal = Number(goalAmount);
      if (isNaN(numGoal) || numGoal < 0 || !isFinite(numGoal)) {
        return res.status(400).json({ error: "Goal amount cannot be negative or invalid." });
      }
    }

    // External URL check
    if (type === "EXTERNAL_LINK") {
      if (!externalUrl || !externalUrl.trim()) {
        return res.status(400).json({ error: "External URL is required for EXTERNAL_LINK registry type." });
      }
      if (!isValidUrl(externalUrl)) {
        return res.status(400).json({ error: "External URL must be a valid HTTP or HTTPS link." });
      }
    } else if (externalUrl) {
      if (!isValidUrl(externalUrl)) {
        return res.status(400).json({ error: "External URL must be a valid HTTP or HTTPS link." });
      }
    }

    // Currency check
    if (currency) {
      const validCurrencies = ["INR", "USD", "EUR", "GBP", "CAD", "AUD"];
      if (!validCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({ error: `Invalid currency: ${currency}.` });
      }
    }

    // Verify event ownership
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(403).json({ error: "Access Denied. You do not own this event." });
    }

    // Check for duplicate registry name under the same event
    const existingRegistry = await registryService.findRegistryByEventAndTitle(eventId, title.trim());
    if (existingRegistry) {
      return res.status(409).json({ error: "Conflict: Registry already exists." });
    }

    const newRegistry = await registryService.createRegistry({
      eventId,
      userId,
      type,
      title: title.trim(),
      description,
      goalAmount,
      currency: currency ? currency.toUpperCase() : "INR",
      externalUrl,
      isActive,
    });

    return res.status(201).json({
      success: true,
      message: "Registry created successfully",
      registry: serializeRegistry(newRegistry),
    });
  } catch (error) {
    console.error("Create Registry Error:", error);
    return res.status(500).json({ error: "Server error during registry creation." });
  }
};

/**
 * Update a registry
 * PUT /api/registries/:id
 */
const updateRegistry = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, description, goalAmount, currentAmount, currency, externalUrl, contributorCount, isActive } = req.body;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: "Registry ID parameter is required." });
    }

    const registry = await registryService.findRegistryById(id);
    if (!registry) {
      return res.status(404).json({ error: "Registry not found." });
    }

    // Verify ownership of the related event
    if (registry.event.createdBy !== userId) {
      return res.status(403).json({ error: "Access Denied. You do not own the related event." });
    }

    // Validate fields if provided
    if (type !== undefined) {
      const validTypes = ["CASH_FUND", "GIFT_REGISTRY", "DONATION", "EXTERNAL_LINK"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid registry type: ${type}.` });
      }
    }
    if (title !== undefined && (!title || !title.trim())) {
      return res.status(400).json({ error: "Title cannot be empty." });
    }
    if (goalAmount !== undefined && goalAmount !== null) {
      const numGoal = Number(goalAmount);
      if (isNaN(numGoal) || numGoal < 0 || !isFinite(numGoal)) {
        return res.status(400).json({ error: "Goal amount cannot be negative or invalid." });
      }
    }
    if (currentAmount !== undefined && currentAmount !== null) {
      const numCurrent = Number(currentAmount);
      if (isNaN(numCurrent) || numCurrent < 0 || !isFinite(numCurrent)) {
        return res.status(400).json({ error: "Current amount cannot be negative or invalid." });
      }
    }
    if (contributorCount !== undefined && contributorCount !== null) {
      const numContributors = Number(contributorCount);
      if (isNaN(numContributors) || numContributors < 0 || !isInteger(numContributors)) {
        return res.status(400).json({ error: "Contributor count must be a non-negative integer." });
      }
    }

    // External URL validation if EXTERNAL_LINK is set or provided
    const resolvedType = type || registry.type;
    const resolvedUrl = externalUrl !== undefined ? externalUrl : registry.externalUrl;
    if (resolvedType === "EXTERNAL_LINK") {
      if (!resolvedUrl || !resolvedUrl.trim()) {
        return res.status(400).json({ error: "External URL is required for EXTERNAL_LINK registry type." });
      }
      if (!isValidUrl(resolvedUrl)) {
        return res.status(400).json({ error: "External URL must be a valid HTTP or HTTPS link." });
      }
    } else if (resolvedUrl) {
      if (!isValidUrl(resolvedUrl)) {
        return res.status(400).json({ error: "External URL must be a valid HTTP or HTTPS link." });
      }
    }

    // Currency check
    if (currency) {
      const validCurrencies = ["INR", "USD", "EUR", "GBP", "CAD", "AUD"];
      if (!validCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({ error: `Invalid currency: ${currency}.` });
      }
    }

    const updated = await registryService.updateRegistry(id, {
      type,
      title: title ? title.trim() : undefined,
      description,
      goalAmount,
      currentAmount,
      currency: currency ? currency.toUpperCase() : undefined,
      externalUrl,
      contributorCount,
      isActive,
    });

    return res.status(200).json({
      success: true,
      message: "Registry updated successfully",
      registry: serializeRegistry(updated),
    });
  } catch (error) {
    console.error("Update Registry Error:", error);
    return res.status(500).json({ error: "Server error during registry update." });
  }
};

/**
 * Delete a registry
 * DELETE /api/registries/:id
 */
const deleteRegistry = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: "Registry ID parameter is required." });
    }

    const registry = await registryService.findRegistryById(id);
    if (!registry) {
      return res.status(404).json({ error: "Registry not found." });
    }

    // Verify ownership of the related event
    if (registry.event.createdBy !== userId) {
      return res.status(403).json({ error: "Access Denied. You do not own the related event." });
    }

    await registryService.deleteRegistry(id);

    return res.status(200).json({
      success: true,
      message: "Registry deleted successfully",
    });
  } catch (error) {
    console.error("Delete Registry Error:", error);
    return res.status(500).json({ error: "Server error during registry deletion." });
  }
};

/**
 * Get dynamic summary totals for event registries
 * GET /api/registries/summary?eventId=:eventId
 */
const getRegistrySummary = async (req, res) => {
  try {
    const { eventId } = req.query;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ error: "eventId is required." });
    }

    // Verify event ownership
    const event = await eventService.findEventByIdAndUserId(eventId, userId);
    if (!event) {
      return res.status(403).json({ error: "Access Denied. You do not own this event." });
    }

    const summary = await registryService.getRegistrySummary(eventId);

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Get Registry Summary Error:", error);
    return res.status(500).json({ error: "Server error retrieving registry summary." });
  }
};

// Helper for integer validation
const isInteger = (val) => Number.isInteger(val);

module.exports = {
  getRegistries,
  getRegistryById,
  createRegistry,
  updateRegistry,
  deleteRegistry,
  getRegistrySummary,
};
