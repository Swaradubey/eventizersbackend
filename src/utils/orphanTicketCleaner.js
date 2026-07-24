const prisma = require("../config/prisma");

/**
 * Cleans up orphan ticket order items and empty ticket orders
 * referencing deleted, missing, or archived ticket tiers.
 * 
 * @param {string} [specificTierId] Optional specific ticket tier ID to purge
 * @returns {Promise<{ deletedItemsCount: number, deletedOrdersCount: number }>}
 */
const cleanOrphanTicketsAndOrders = async (specificTierId) => {
  try {
    let deletedItemsCount = 0;
    let deletedOrdersCount = 0;

    if (specificTierId) {
      // 1. Delete order items directly referencing specificTierId
      const deleteResult = await prisma.ticketOrderItem.deleteMany({
        where: { ticketTierId: specificTierId },
      });
      deletedItemsCount += deleteResult.count;
    }

    // 2. Find and delete order items whose ticket tier is archived or inactive
    const orphanItems = await prisma.ticketOrderItem.findMany({
      where: {
        OR: [
          { ticketTier: { status: "ARCHIVED" } },
          { ticketTier: { isActive: false } },
        ],
      },
      select: { id: true },
    });

    if (orphanItems.length > 0) {
      const orphanIds = orphanItems.map((item) => item.id);
      const deleteOrphansResult = await prisma.ticketOrderItem.deleteMany({
        where: { id: { in: orphanIds } },
      });
      deletedItemsCount += deleteOrphansResult.count;
    }

    // 3. Delete any ticket orders that no longer have any order items remaining
    const emptyOrders = await prisma.ticketOrder.findMany({
      where: {
        items: {
          none: {},
        },
      },
      select: { id: true },
    });

    if (emptyOrders.length > 0) {
      const emptyOrderIds = emptyOrders.map((o) => o.id);
      const deleteEmptyOrdersResult = await prisma.ticketOrder.deleteMany({
        where: { id: { in: emptyOrderIds } },
      });
      deletedOrdersCount += deleteEmptyOrdersResult.count;
    }

    if (deletedItemsCount > 0 || deletedOrdersCount > 0) {
      console.log(
        `[OrphanTicketCleaner] Purged ${deletedItemsCount} orphan order items and ${deletedOrdersCount} empty orders.`
      );
    }

    return { deletedItemsCount, deletedOrdersCount };
  } catch (error) {
    console.error("[OrphanTicketCleaner] Error cleaning up orphan records:", error);
    return { deletedItemsCount: 0, deletedOrdersCount: 0 };
  }
};

module.exports = {
  cleanOrphanTicketsAndOrders,
};
