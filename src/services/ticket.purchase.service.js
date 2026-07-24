const prisma = require("../config/prisma");
const stripe = require("../config/stripe");

/**
 * Create a Stripe checkout session for purchasing a ticket
 */
const createCheckoutSession = async (eventId, ticketTierId, quantity, user) => {
  if (!stripe) {
    throw new Error("Stripe is not configured on the server.");
  }

  // 1. Validate inputs
  const parsedQuantity = parseInt(quantity, 10);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }

  // 2. Validate event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!event) {
    throw new Error("Event not found.");
  }

  // 3. Validate ticket tier exists and belongs to the event
  const tier = await prisma.ticketTier.findUnique({
    where: { id: ticketTierId },
  });
  if (!tier || tier.eventId !== eventId) {
    throw new Error("Invalid ticket tier for this event.");
  }

  // 4. Validate ticket is active
  if (!tier.isActive || tier.status !== "ACTIVE") {
    throw new Error("Ticket tier is not currently active.");
  }

  // 5. Validate min/max order limits
  if (parsedQuantity < tier.minPerOrder) {
    throw new Error(`Minimum tickets per order is ${tier.minPerOrder}.`);
  }
  if (tier.maxPerOrder && parsedQuantity > tier.maxPerOrder) {
    throw new Error(`Maximum tickets per order is ${tier.maxPerOrder}.`);
  }

  // 6. Check availability (capacity)
  const itemsAgg = await prisma.ticketOrderItem.aggregate({
    where: {
      ticketTierId,
      order: {
        status: "PAID",
      },
    },
    _sum: {
      quantity: true,
    },
  });
  const quantitySold = itemsAgg._sum.quantity || 0;
  const remainingQuantity = Math.max(0, tier.capacity - quantitySold);
  if (parsedQuantity > remainingQuantity) {
    throw new Error("Sold out or insufficient tickets available.");
  }

  // 7. Calculate amount (backend calculated)
  const unitPrice = parseFloat(tier.price.toString());
  const totalAmount = unitPrice * parsedQuantity;
  const currency = tier.currency || "INR";

  // Stripe expects amount in cents/paise
  const stripeAmount = Math.round(unitPrice * 100);

  // 8. Prepare Stripe Success and Cancel URLs
  let frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  if (frontendUrl.endsWith("/")) {
    frontendUrl = frontendUrl.slice(0, -1);
  }

  // 9. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `${event.title} - ${tier.name}`,
            description: tier.description || undefined,
          },
          unit_amount: stripeAmount,
        },
        quantity: parsedQuantity,
      },
    ],
    mode: "payment",
    success_url: `${frontendUrl}/dashboard/ticketing?eventId=${eventId}&session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${frontendUrl}/dashboard/ticketing?eventId=${eventId}&canceled=true`,
    customer_email: user.email,
    metadata: {
      eventId,
      ticketTierId,
      quantity: String(parsedQuantity),
      userId: String(user.id),
    },
  });

  // 10. Create a PENDING order record in database
  await prisma.ticketOrder.create({
    data: {
      eventId,
      userId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      status: "PENDING",
      subtotal: totalAmount,
      totalAmount: totalAmount,
      currency: currency,
      stripeSessionId: session.id,
      items: {
        create: [
          {
            ticketTierId,
            quantity: parsedQuantity,
            unitPrice: unitPrice,
            totalPrice: totalAmount,
          },
        ],
      },
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};

/**
 * Get all ticket purchases for a user
 */
const getMyTickets = async (userId, eventId) => {
  const { cleanOrphanTicketsAndOrders } = require("../utils/orphanTicketCleaner");
  await cleanOrphanTicketsAndOrders();

  const whereClause = {
    userId: parseInt(userId, 10),
    status: "PAID",
    items: {
      some: {
        ticketTier: {
          status: {
            not: "ARCHIVED",
          },
          isActive: true,
        },
      },
    },
  };

  if (eventId) {
    whereClause.eventId = eventId;
  }

  const rawOrders = await prisma.ticketOrder.findMany({
    where: whereClause,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      items: {
        where: {
          ticketTier: {
            status: {
              not: "ARCHIVED",
            },
            isActive: true,
          },
        },
        include: {
          ticketTier: {
            select: {
              id: true,
              name: true,
              status: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Filter out any orders where items became empty or ticketTier is deleted/archived
  return rawOrders
    .map((order) => {
      const validItems = (order.items || []).filter(
        (item) => item.ticketTier && item.ticketTier.status !== "ARCHIVED" && item.ticketTier.isActive
      );
      return {
        ...order,
        items: validItems,
      };
    })
    .filter((order) => order.items.length > 0);
};

/**
 * Get ticket order details by Stripe session ID and verify directly with Stripe
 */
const verifyAndGetSessionDetails = async (sessionId, requestingUserId) => {
  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  // 1. Fetch order from DB if it exists
  let order = await prisma.ticketOrder.findUnique({
    where: {
      stripeSessionId: sessionId,
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
        },
      },
      items: {
        include: {
          ticketTier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Security ownership check if order exists
  if (order && order.userId && requestingUserId && order.userId !== parseInt(requestingUserId, 10)) {
    const error = new Error("Unauthorized access to order details.");
    error.statusCode = 403;
    throw error;
  }

  // Helper to format consistent ticket object
  const formatTicketResponse = (ord) => {
    const firstItem = ord.items?.[0] || {};
    return {
      id: ord.id,
      eventId: ord.eventId,
      eventTitle: ord.event?.title || "Event",
      ticketTierName: firstItem.ticketTier?.name || "Ticket",
      ticketNumber: ord.id,
      paymentStatus: ord.status.toLowerCase(),
      totalAmount: ord.totalAmount,
      currency: ord.currency,
      quantity: firstItem.quantity || 1,
      paidAt: ord.paidAt || ord.createdAt,
    };
  };

  // 2. If order exists and status is already PAID, return immediately (idempotent)
  if (order && order.status === "PAID") {
    return {
      success: true,
      status: "confirmed",
      order,
      ticket: formatTicketResponse(order),
    };
  }

  // 3. Verify directly with Stripe if stripe instance is available
  if (stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session) {
        const isPaymentPaid = session.payment_status === "paid" || session.status === "complete";
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

        if (isPaymentPaid) {
          if (order) {
            // Update order status to PAID
            order = await prisma.ticketOrder.update({
              where: { id: order.id },
              data: {
                status: "PAID",
                paymentIntentId: paymentIntentId,
                paidAt: new Date(),
              },
              include: {
                event: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
                items: {
                  include: {
                    ticketTier: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            });
          } else {
            // Order does not exist in DB yet — create it from Stripe session metadata
            const eventId = session.metadata?.eventId;
            const ticketTierId = session.metadata?.ticketTierId;
            const quantity = parseInt(session.metadata?.quantity || "1", 10);
            const userId = session.metadata?.userId
              ? parseInt(session.metadata.userId, 10)
              : requestingUserId ? parseInt(requestingUserId, 10) : null;

            if (eventId && ticketTierId && userId) {
              const [user, event, tier] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId } }),
                prisma.event.findUnique({ where: { id: eventId } }),
                prisma.ticketTier.findUnique({ where: { id: ticketTierId } }),
              ]);

              if (event && tier && user) {
                const unitPrice = parseFloat(tier.price.toString());
                const totalAmount = unitPrice * quantity;
                const currency = tier.currency || "INR";

                order = await prisma.ticketOrder.create({
                  data: {
                    eventId,
                    userId: user.id,
                    customerName: user.name,
                    customerEmail: user.email,
                    status: "PAID",
                    subtotal: totalAmount,
                    totalAmount: totalAmount,
                    currency: currency,
                    stripeSessionId: session.id,
                    paymentIntentId: paymentIntentId,
                    paidAt: new Date(),
                    items: {
                      create: [
                        {
                          ticketTierId,
                          quantity,
                          unitPrice: unitPrice,
                          totalPrice: totalAmount,
                        },
                      ],
                    },
                  },
                  include: {
                    event: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                    items: {
                      include: {
                        ticketTier: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                });
              }
            }
          }

          if (order && order.status === "PAID") {
            return {
              success: true,
              status: "confirmed",
              order,
              ticket: formatTicketResponse(order),
            };
          }
        } else if (session.status === "open" || session.payment_status === "unpaid") {
          return {
            success: true,
            status: "processing",
            order: order || null,
          };
        } else if (session.status === "expired") {
          if (order) {
            await prisma.ticketOrder.update({
              where: { id: order.id },
              data: { status: "EXPIRED" },
            });
          }
          return {
            success: false,
            status: "failed",
            message: "Payment session has expired.",
          };
        }
      }
    } catch (stripeErr) {
      console.error("[ticketPurchaseService] Error retrieving Stripe session:", stripeErr.message);
    }
  }

  // 4. Fallback checking DB order status
  if (order) {
    if (order.status === "PAID") {
      return {
        success: true,
        status: "confirmed",
        order,
        ticket: formatTicketResponse(order),
      };
    }
    return {
      success: true,
      status: "processing",
      order,
    };
  }

  return {
    success: false,
    status: "failed",
    message: "Payment could not be verified.",
  };
};

const getSessionDetails = async (sessionId, requestingUserId) => {
  const result = await verifyAndGetSessionDetails(sessionId, requestingUserId);
  if (result.success && result.order) {
    return result.order;
  }
  return null;
};

module.exports = {
  createCheckoutSession,
  getMyTickets,
  getSessionDetails,
  verifyAndGetSessionDetails,
};

