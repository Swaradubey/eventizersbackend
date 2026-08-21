const path = require("path");

// Load local .env for local testing / vercel dev without crashing if missing
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch (_) {}

let app;
try {
  app = require("../src/app");
} catch (err) {
  console.error("[api/index.js] Critical error during app bootstrap:", err);
}

// Export Express app as standard Vercel serverless function handler
module.exports = (req, res) => {
  if (!app) {
    try {
      app = require("../src/app");
    } catch (err) {
      console.error("[api/index.js] Handler failed to load app:", err);
      return res.status(500).json({
        status: "error",
        error: "Function Invocation Failed: Backend application failed to initialize.",
        message: err.message,
      });
    }
  }

  return app(req, res);
};

