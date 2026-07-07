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
    success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/payment/cancel`,
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
const getMyTickets = async (userId) => {
  return await prisma.ticketOrder.findMany({
    where: {
      userId: parseInt(userId, 10),
    },
    include: {
      event: {
        select: {
          title: true,
        },
      },
      items: {
        include: {
          ticketTier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Get ticket order details by Stripe session ID (for success page)
 */
const getSessionDetails = async (sessionId) => {
  return await prisma.ticketOrder.findUnique({
    where: {
      stripeSessionId: sessionId,
    },
    include: {
      event: {
        select: {
          title: true,
        },
      },
      items: {
        include: {
          ticketTier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
};

module.exports = {
  createCheckoutSession,
  getMyTickets,
  getSessionDetails,
};
