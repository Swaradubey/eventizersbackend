const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");

/**
 * Helper to verify that a user owns the event
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const verifyEventOwnership = async (eventId, userId) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      createdBy: parseInt(userId, 10),
    },
  });
  return !!event;
};

/**
 * Get all events created by a specific user for dropdown selection
 * @param {number} userId
 * @returns {Promise<Array>}
 */
const getEventsByUserId = async (userId) => {
  return await prisma.event.findMany({
    where: {
      createdBy: parseInt(userId, 10),
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Get ticketing stats summary for an event
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const getEventSummary = async (eventId, userId) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    throw new Error("Unauthorized event access.");
  }

  // 1. Calculate ticketsSold (quantities from successful/PAID ticket orders for the event)
  const itemsAgg = await prisma.ticketOrderItem.aggregate({
    where: {
      order: {
        eventId,
        status: "PAID",
      },
    },
    _sum: {
      quantity: true,
    },
  });
  const ticketsSold = itemsAgg._sum.quantity || 0;

  // 2. Calculate totalRevenue (sum of paid order totals)
  const revenueAgg = await prisma.ticketOrder.aggregate({
    where: {
      eventId,
      status: "PAID",
    },
    _sum: {
      totalAmount: true,
    },
  });
  const totalRevenue = revenueAgg._sum.totalAmount
    ? parseFloat(revenueAgg._sum.totalAmount.toString())
    : 0.0;

  // 3. Calculate capacity (sum of capacities of all active ticket tiers)
  const capacityAgg = await prisma.ticketTier.aggregate({
    where: {
      eventId,
      isActive: true,
      status: {
        not: "ARCHIVED",
      },
    },
    _sum: {
      capacity: true,
    },
  });
  const capacity = capacityAgg._sum.capacity || 0;

  // 4. Calculate sellThrough percentage
  const sellThrough = capacity > 0 ? Math.round((ticketsSold / capacity) * 100) : 0;

  return {
    totalRevenue,
    ticketsSold,
    capacity,
    sellThrough,
  };
};

/**
 * Get all ticket tiers for an event, including sales performance numbers
 * @param {string} eventId
 * @param {number} userId
 * @returns {Promise<Array>}
 */
const getEventTiers = async (eventId, userId) => {
  const isOwner = await verifyEventOwnership(eventId, userId);
  if (!isOwner) {
    throw new Error("Unauthorized event access.");
  }

  // Fetch all non-archived tiers for this event
  const tiers = await prisma.ticketTier.findMany({
    where: {
      eventId,
      status: {
        not: "ARCHIVED",
      },
    },
    include: {
      orderItems: {
        where: {
          order: {
            status: "PAID",
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return tiers.map((tier) => {
    // Calculate total quantity sold
    const quantitySold = tier.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    // Calculate remaining capacity
    const remainingQuantity = Math.max(0, tier.capacity - quantitySold);
    // Calculate revenue earned
    const revenueEarned = tier.orderItems.reduce(
      (sum, item) => sum + parseFloat(item.totalPrice.toString()),
      0.0
    );

    // Compute dynamic status
    let status = tier.status;
    const now = new Date();
    if (!tier.isActive || tier.status === "INACTIVE") {
      status = "INACTIVE";
    } else if (quantitySold >= tier.capacity) {
      status = "SOLD_OUT";
    } else if (tier.salesStartAt && new Date(tier.salesStartAt) > now) {
      status = "SCHEDULED";
    } else if (tier.salesEndAt && new Date(tier.salesEndAt) < now) {
      status = "EXPIRED";
    } else {
      status = "ACTIVE";
    }

    return {
      id: tier.id,
      eventId: tier.eventId,
      name: tier.name,
      description: tier.description,
      price: parseFloat(tier.price.toString()),
      currency: tier.currency,
      capacity: tier.capacity,
      minPerOrder: tier.minPerOrder,
      maxPerOrder: tier.maxPerOrder,
      salesStartAt: tier.salesStartAt,
      salesEndAt: tier.salesEndAt,
      status,
      isActive: tier.isActive,
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
      quantitySold,
      remainingQuantity,
      revenueEarned,
    };
  });
};

/**
 * Get details of a single ticket tier
 * @param {string} tierId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const getTicketTierById = async (tierId, userId) => {
  const tier = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    include: {
      event: true,
      orderItems: {
        where: {
          order: {
            status: "PAID",
          },
        },
      },
    },
  });

  if (!tier) return null;

  if (tier.event.createdBy !== parseInt(userId, 10)) {
    throw new Error("Unauthorized tier access.");
  }

  const quantitySold = tier.orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const remainingQuantity = Math.max(0, tier.capacity - quantitySold);
  const revenueEarned = tier.orderItems.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice.toString()),
    0.0
  );

  return {
    id: tier.id,
    eventId: tier.eventId,
    name: tier.name,
    description: tier.description,
    price: parseFloat(tier.price.toString()),
    currency: tier.currency,
    capacity: tier.capacity,
    minPerOrder: tier.minPerOrder,
    maxPerOrder: tier.maxPerOrder,
    salesStartAt: tier.salesStartAt,
    salesEndAt: tier.salesEndAt,
    status: tier.status,
    isActive: tier.isActive,
    createdAt: tier.createdAt,
    updatedAt: tier.updatedAt,
    quantitySold,
    remainingQuantity,
    revenueEarned,
  };
};

/**
 * Create a new ticket tier
 * @param {string} eventId
 * @param {Object} tierData
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const createTicketTier = async (eventId, tierData, userId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!event) {
    throw new Error("Event not found.");
  }
  if (event.createdBy !== parseInt(userId, 10)) {
    throw new Error("Unauthorized event access.");
  }

  const {
    name,
    description,
    price,
    currency,
    capacity,
    minPerOrder,
    maxPerOrder,
    salesStartAt,
    salesEndAt,
    status,
    isActive,
  } = tierData;

  const dbStatus = (status === "SCHEDULED" || status === "SOLD_OUT" || status === "EXPIRED") 
    ? "ACTIVE" 
    : (status || "ACTIVE");

  const newTier = await prisma.ticketTier.create({
    data: {
      eventId,
      name: name.trim(),
      description: description ? description.trim() : null,
      price: new Prisma.Decimal(String(price)),
      currency: currency || "INR",
      capacity: parseInt(capacity, 10),
      minPerOrder: parseInt(minPerOrder, 10) || 1,
      maxPerOrder: maxPerOrder ? parseInt(maxPerOrder, 10) : null,
      salesStartAt: salesStartAt ? new Date(salesStartAt) : null,
      salesEndAt: salesEndAt ? new Date(salesEndAt) : null,
      status: dbStatus,
      isActive: isActive !== undefined ? !!isActive : true,
    },
  });

  return {
    ...newTier,
    price: parseFloat(newTier.price.toString()),
  };
};

/**
 * Update an existing ticket tier
 * @param {string} tierId
 * @param {Object} tierData
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const updateTicketTier = async (tierId, tierData, userId) => {
  const existingTier = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    include: {
      event: true,
      orderItems: {
        where: {
          order: {
            status: "PAID",
          },
        },
      },
    },
  });

  if (!existingTier) {
    throw new Error("Ticket tier not found.");
  }

  if (existingTier.event.createdBy !== parseInt(userId, 10)) {
    throw new Error("Unauthorized event access.");
  }

  const quantitySold = existingTier.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const {
    name,
    description,
    price,
    currency,
    capacity,
    minPerOrder,
    maxPerOrder,
    salesStartAt,
    salesEndAt,
    status,
    isActive,
  } = tierData;

  const newCapacity = parseInt(capacity, 10);
  if (!isNaN(newCapacity) && newCapacity < quantitySold) {
    throw new Error("Capacity cannot be reduced below the number of tickets already sold.");
  }

  const dbStatus = (status === "SCHEDULED" || status === "SOLD_OUT" || status === "EXPIRED") 
    ? "ACTIVE" 
    : status;

  const updatedTier = await prisma.ticketTier.update({
    where: { id: tierId },
    data: {
      name: name ? name.trim() : existingTier.name,
      description: description !== undefined ? (description ? description.trim() : null) : existingTier.description,
      price: price !== undefined ? new Prisma.Decimal(String(price)) : existingTier.price,
      currency: currency !== undefined ? currency : existingTier.currency,
      capacity: !isNaN(newCapacity) ? newCapacity : existingTier.capacity,
      minPerOrder: minPerOrder !== undefined ? parseInt(minPerOrder, 10) : existingTier.minPerOrder,
      maxPerOrder: maxPerOrder !== undefined ? (maxPerOrder ? parseInt(maxPerOrder, 10) : null) : existingTier.maxPerOrder,
      salesStartAt: salesStartAt !== undefined ? (salesStartAt ? new Date(salesStartAt) : null) : existingTier.salesStartAt,
      salesEndAt: salesEndAt !== undefined ? (salesEndAt ? new Date(salesEndAt) : null) : existingTier.salesEndAt,
      status: dbStatus !== undefined ? dbStatus : existingTier.status,
      isActive: isActive !== undefined ? !!isActive : existingTier.isActive,
    },
  });

  return {
    ...updatedTier,
    price: parseFloat(updatedTier.price.toString()),
  };
};

/**
 * Delete a ticket tier (delete if no sales, archive if sales exist)
 * @param {string} tierId
 * @param {number} userId
 * @returns {Promise<Object>} { deleted: boolean, archived: boolean, message: string }
 */
const deleteTicketTier = async (tierId, userId) => {
  const existingTier = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    include: {
      event: true,
      orderItems: {
        where: {
          order: {
            status: "PAID",
          },
        },
      },
    },
  });

  if (!existingTier) {
    throw new Error("Ticket tier not found.");
  }

  if (existingTier.event.createdBy !== parseInt(userId, 10)) {
    throw new Error("Unauthorized event access.");
  }

  const quantitySold = existingTier.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  if (quantitySold > 0) {
    // Has sales, soft delete by archiving to preserve order history
    await prisma.ticketTier.update({
      where: { id: tierId },
      data: {
        status: "ARCHIVED",
        isActive: false,
      },
    });

    return {
      deleted: false,
      archived: true,
      message: "Ticket tier archived successfully because it contains sales history.",
    };
  } else {
    // No sales, safe to hard delete
    await prisma.ticketTier.delete({
      where: { id: tierId },
    });

    return {
      deleted: true,
      archived: false,
      message: "Ticket tier deleted successfully.",
    };
  }
};

module.exports = {
  getEventsByUserId,
  getEventSummary,
  getEventTiers,
  getTicketTierById,
  createTicketTier,
  updateTicketTier,
  deleteTicketTier,
};
