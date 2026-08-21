"use strict";
const path = require("path");

// Load .env for local / vercel dev — safe no-op if file is absent in production
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch (_) {}

// Bootstrap the Express app once at module load time.
// On Vercel, module-level code is cached between warm invocations.
let app = null;
let bootstrapError = null;

try {
  const appPath = path.resolve(__dirname, "../src/app");
  console.log("[api/index.js] Bootstrapping app from:", appPath);
  app = require(appPath);
} catch (err) {
  bootstrapError = err;
  console.error("[api/index.js] FATAL: app bootstrap failed:", err.message);
  console.error("[api/index.js] Stack:", err.stack);
}

/**
 * Vercel Serverless Function handler.
 * The Express `app` is callable as a plain Node.js (req, res) handler.
 */
module.exports = (req, res) => {
  // If bootstrap failed on module load, attempt a single retry then surface a clear 500.
  if (!app) {
    try {
      app = require(path.resolve(__dirname, "../src/app"));
      bootstrapError = null;
    } catch (err) {
      bootstrapError = err;
      console.error("[api/index.js] Retry bootstrap failed:", err.message);
      console.error("[api/index.js] Stack:", err.stack);
    }
  }

  if (!app) {
    return res.status(500).json({
      status: "error",
      error: "Function Invocation Failed: Backend application failed to initialize.",
      message: bootstrapError ? bootstrapError.message : "Unknown error",
    });
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error("[api/index.js] Unhandled error in Express handler:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  }
};

