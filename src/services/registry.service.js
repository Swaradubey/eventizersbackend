const prisma = require("../config/prisma");

/**
 * Find a specific registry by its ID, including the related event
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const findRegistryById = async (id) => {
  return await prisma.registry.findUnique({
    where: { id },
    include: {
      event: true,
    },
  });
};

/**
 * Find all registries for a specific event
 * @param {string} eventId
 * @returns {Promise<Array>}
 */
const findRegistriesByEventId = async (eventId) => {
  return await prisma.registry.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Create a new registry
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const createRegistry = async (data) => {
  const { eventId, type, title, description, goalAmount, currency, externalUrl, isActive } = data;
  return await prisma.registry.create({
    data: {
      eventId,
      type,
      title,
      description: description || null,
      goalAmount: goalAmount !== undefined && goalAmount !== null ? Number(goalAmount) : null,
      currentAmount: 0,
      currency: currency || "INR",
      externalUrl: externalUrl || null,
      contributorCount: 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    },
  });
};

/**
 * Update an existing registry
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const updateRegistry = async (id, data) => {
  const { type, title, description, goalAmount, currentAmount, currency, externalUrl, contributorCount, isActive } = data;
  
  const updateData = {};
  if (type !== undefined) updateData.type = type;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description || null;
  if (goalAmount !== undefined) updateData.goalAmount = goalAmount !== null ? Number(goalAmount) : null;
  if (currentAmount !== undefined) updateData.currentAmount = Number(currentAmount);
  if (currency !== undefined) updateData.currency = currency;
  if (externalUrl !== undefined) updateData.externalUrl = externalUrl || null;
  if (contributorCount !== undefined) updateData.contributorCount = Number(contributorCount);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  return await prisma.registry.update({
    where: { id },
    data: updateData,
  });
};

/**
 * Delete a registry
 * @param {string} id
 * @returns {Promise<Object>}
 */
const deleteRegistry = async (id) => {
  return await prisma.registry.delete({
    where: { id },
  });
};

/**
 * Get dynamic registry summary stats for an event
 * @param {string} eventId
 * @returns {Promise<Object>}
 */
const getRegistrySummary = async (eventId) => {
  const registries = await prisma.registry.findMany({
    where: { eventId },
    select: {
      currentAmount: true,
      contributorCount: true,
    },
  });

  const totalRaised = registries.reduce((sum, r) => sum + Number(r.currentAmount), 0);
  const totalContributors = registries.reduce((sum, r) => sum + r.contributorCount, 0);
  const registryCount = registries.length;

  return {
    totalRaised,
    totalContributors,
    registryCount,
  };
};

module.exports = {
  findRegistryById,
  findRegistriesByEventId,
  createRegistry,
  updateRegistry,
  deleteRegistry,
  getRegistrySummary,
};
