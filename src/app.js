const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const eventRoutes = require("./routes/event.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const invitationRoutes = require("./routes/invitation.routes");
const guestRoutes = require("./routes/guest.routes");
const ticketingRoutes = require("./routes/ticketing.routes");
const ticketPurchaseRoutes = require("./routes/ticket.purchase.routes");
const userBillingRoutes = require("./routes/user.billing.routes");
const stripeWebhookRoutes = require("./routes/stripe.webhook.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const aiRoutes = require("./routes/ai.routes");

const app = express();

// Prevent 500 crashes on automatic browser favicon requests
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Trust proxy for secure cookies on Vercel
app.set("trust proxy", 1);

// Configure CORS to allow frontend to access APIs with cookies
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(",").map((url) => url.trim());
  allowedOrigins.push(...urls);
}

const cleanedAllowedOrigins = allowedOrigins.filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow if exact match in configured allowed origins
      if (cleanedAllowedOrigins.includes(origin) || cleanedAllowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // Allow any localhost origin
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments (.vercel.app)
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // If not strictly matched, permit rather than throwing a fatal server error
      return callback(null, true);
    },
    credentials: true,
  })
);

// Stripe Webhook Route — must be BEFORE express.json() for raw body signature verification
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Base and Health Routes
app.get("/", (req, res) => {
  res.status(200).json({ status: "healthy", message: "Backend is running on Vercel" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", message: "Backend is running" });
});

app.get("/api", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", message: "Backend is running" });
});


// Auth Routes
app.use("/api/auth", authRoutes);

// Admin Routes
app.use("/api/admin", adminRoutes);

// Event Routes
app.use("/api/events", eventRoutes);

// AI Routes
app.use("/api/ai", aiRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// Invitation Routes
app.use("/api/invitations", invitationRoutes);

// Guest Routes
app.use("/api/guests", guestRoutes);

// Ticketing Routes
app.use("/api/ticketing", ticketingRoutes);
app.use("/api/tickets", ticketPurchaseRoutes);

// User Billing Routes
app.use("/api/user/billing", userBillingRoutes);
app.use("/api/plans", subscriptionRoutes);

// Stripe Checkout and Billing Portal Routes
const stripeRoutes = require("./routes/stripe.routes");
app.use("/api/stripe", stripeRoutes);

// Billing Routes (activate-free, checkout-session via billing controller)
const billingRoutes = require("./routes/billing.routes");
app.use("/api/billing", billingRoutes);

// Check-In Routes
const checkInRoutes = require("./routes/checkIn.routes");
app.use("/api/check-ins", checkInRoutes);

// Registries Routes
const registryRoutes = require("./routes/registry.routes");
app.use("/api/registries", registryRoutes);

// Messages Routes
const messageRoutes = require("./routes/message.routes");
app.use("/api/messages", messageRoutes);

// Security Routes
const securityRoutes = require("./routes/security.routes");
app.use("/api/security", securityRoutes);

// Admin Settings Routes
const settingsRoutes = require("./routes/settings.routes");
app.use("/api/admin/settings", settingsRoutes);

// User Settings Routes
const userSettingsRoutes = require("./routes/user.settings.routes");
app.use("/api/user/settings", userSettingsRoutes);

// Templates Routes
const templatesRoutes = require("./routes/templates.routes");
app.use("/api/templates", templatesRoutes);

// Analytics Routes
const analyticsRoutes = require("./routes/analytics.routes");
app.use("/api/analytics", analyticsRoutes);

// Open Tracking Pixel Routes
const trackRoutes = require("./routes/track.routes");
app.use("/api/track", trackRoutes);

// Serve uploads folder statically
const path = require("path");
const fs = require("fs");
const uploadsPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
  } catch (e) {
    console.warn("Could not create uploads directory:", e.message);
  }
}
app.use("/uploads", express.static(uploadsPath, {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

// 404 Route handler
const notFound = (req, res, next) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl} - API endpoint not found.` });
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected error occurred on the server.";
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
  });
};

// after all API routes
app.use(notFound);
app.use(errorHandler);

module.exports = app;
