const Stripe = require("stripe");

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.warn("[stripe] STRIPE_SECRET_KEY is not set. Stripe functionality will be unavailable.");
}

const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: "2024-06-20" })
  : null;

module.exports = stripe;
