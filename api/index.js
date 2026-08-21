const path = require("path");

// Load local .env for local testing/vercel dev without crashing if missing
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch (_) {}

const app = require("../src/app");

// Export Express app as standard Vercel serverless function handler
module.exports = app;
