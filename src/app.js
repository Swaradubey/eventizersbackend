const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/event.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const invitationRoutes = require("./routes/invitation.routes");
const guestRoutes = require("./routes/guest.routes");
const ticketingRoutes = require("./routes/ticketing.routes");

const app = express();

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
      // Allow requests with no origin (like mobile apps, curl)
      if (!origin) return callback(null, true);
      if (cleanedAllowedOrigins.indexOf(origin) === -1 && !origin.startsWith("http://localhost:")) {
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Base Route
app.get("/", (req, res) => {
  res.json({ message: "Eventizers Authentication API is running." });
});

// Health Routes
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Backend is running" });
});
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Backend is running" });
});

// Auth Routes
app.use("/api/auth", authRoutes);

// Event Routes
app.use("/api/events", eventRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// Invitation Routes
app.use("/api/invitations", invitationRoutes);

// Guest Routes
app.use("/api/guests", guestRoutes);

// Ticketing Routes
app.use("/api/ticketing", ticketingRoutes);

// Check-In Routes
const checkInRoutes = require("./routes/checkIn.routes");
app.use("/api/check-ins", checkInRoutes);




// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "An unexpected error occurred on the server." });
});

module.exports = app;
