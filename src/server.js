const path = require("path");
const fs = require("fs");
const dns = require("dns").promises;

// Capture port from environment before dotenv potentially loads it from .env
const envPort = process.env.PORT;

// Ensure dotenv is loaded before anything else
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

console.log("[database] Environment loaded");

// Gemini API key diagnostic (log only whether loaded, not the actual key)
const geminiKey = process.env.GEMINI_API_KEY;
console.log(`Gemini API key loaded: ${geminiKey && geminiKey !== 'your_gemini_api_key_here' && geminiKey !== '' ? 'yes' : 'no'}`);

// Gemini model diagnostic
console.log(`Gemini model used: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);

// Validate Stripe environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripeProPrice = process.env.STRIPE_PRO_PRICE_ID?.trim();
const stripeBusinessPrice = process.env.STRIPE_BUSINESS_PRICE_ID?.trim();
const frontendUrl = process.env.FRONTEND_URL?.trim();

if (!stripeSecretKey) {
  console.warn("[stripe] STRIPE_SECRET_KEY is not set. Subscription billing will be unavailable.");
}
if (!stripeWebhookSecret) {
  console.warn("[stripe] STRIPE_WEBHOOK_SECRET is not set. Webhook verification will fail.");
}
if (!stripeProPrice) {
  console.warn("[stripe] STRIPE_PRO_PRICE_ID is not set. Pro subscription will be unavailable.");
}
if (!stripeBusinessPrice) {
  console.warn("[stripe] STRIPE_BUSINESS_PRICE_ID is not set. Business subscription will be unavailable.");
}
if (!frontendUrl) {
  console.warn("[stripe] FRONTEND_URL is not set. Checkout redirects may fail.");
}

// Validate DATABASE_URL existence
if (!process.env.DATABASE_URL) {
  console.error("[env] DATABASE_URL is missing.");
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL;

try {
  const parsed = new URL(dbUrl);
  if (!parsed.protocol.startsWith("postgres")) {
    throw new Error("Invalid protocol. Must start with postgresql:// or postgres://");
  }
  if (!parsed.hostname) {
    throw new Error("Hostname is missing in DATABASE_URL");
  }
} catch (err) {
  console.error("[database] Malformed DATABASE_URL in backend/.env. Error:", err.message);
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}

// Log safe startup diagnostics
let dbDetails = null;
try {
  const parsed = new URL(dbUrl);
  const hasSsl = parsed.searchParams.get("sslmode") === "require" || dbUrl.includes("sslmode=require");
  dbDetails = {
    hostname: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, ""),
    sslMode: hasSsl ? "require" : "none"
  };
  
  console.log("[database] Database Diagnostics:");
  console.log(` - Hostname: ${dbDetails.hostname}`);
  console.log(` - Port: ${dbDetails.port}`);
  console.log(` - Database: ${dbDetails.database}`);
  console.log(` - SSL Mode: ${dbDetails.sslMode}`);
} catch (_) {
  // Silent catch as we already validated it
}

const app = require("./app");
const prisma = require("./config/prisma");
const db = require("./config/db");

const PORT = parseInt(envPort || process.env.PORT || 5000, 10);

async function verifyDns(hostname) {
  try {
    console.log(`[database] Verifying DNS resolution for hostname: ${hostname}...`);
    const lookup = await dns.lookup(hostname);
    console.log(`[database] DNS resolved successfully to: ${lookup.address}`);
    return true;
  } catch (err) {
    console.warn(`[database] DNS lookup failed for ${hostname}: ${err.message}`);
    return false;
  }
}

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, "../migration.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    await db.query(sql);
    console.log("[database] Database migration ran successfully.");
  } catch (err) {
    console.error("[database] Failed to run database migration:", err.message);
    throw err;
  }
}

function handleConnectionError(error) {
  console.error("[database] PostgreSQL connection failed");

  if (error && typeof error === "object" && "code" in error) {
    console.error("[database] Prisma error code:", error.code);
  }

  const errMsg = error.message || "";
  const errCode = error.code || "";
  
  // Sanitize username and password from error message to avoid leaks
  let sanitizedMsg = errMsg;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      if (parsed.password) {
        sanitizedMsg = sanitizedMsg.replace(parsed.password, "******");
      }
      if (parsed.username) {
        sanitizedMsg = sanitizedMsg.replace(parsed.username, "******");
      }
    } catch (_) {}
  }

  console.error(`[database] Error Details: ${sanitizedMsg}`);

  // Classify common network/database connection errors
  const isDnsError = errCode === "ENOTFOUND" || errCode === "EAI_AGAIN" || sanitizedMsg.includes("ENOTFOUND") || sanitizedMsg.includes("EAI_AGAIN");
  const isTimeoutError = errCode === "ETIMEDOUT" || sanitizedMsg.includes("ETIMEDOUT") || sanitizedMsg.includes("timeout") || sanitizedMsg.includes("P1001");
  const isConnRefused = errCode === "ECONNREFUSED" || sanitizedMsg.includes("ECONNREFUSED");
  const isPrismaP1001 = sanitizedMsg.includes("P1001") || sanitizedMsg.includes("Can't reach database server");

  console.log("\n=================== TROUBLESHOOTING GUIDE ===================");
  if (isDnsError) {
    console.log("Category: DNS Resolution Failure");
    console.log("Explanation: The hostname could not be resolved. This is likely because the hostname in your connection string is incorrect, or you are experiencing DNS/internet issues.");
    console.log("Action Required:");
    console.log(" 1. Please double check that the connection string was copied from the correct Neon project and branch.");
    console.log(" 2. Confirm your database connection string in backend/.env does not contain typos.");
    console.log(" 3. Verify your internet connection or try using standard public DNS resolvers.");
  } else if (isTimeoutError || isPrismaP1001) {
    console.log("Category: Database Unreachable / Connection Timeout");
    console.log("Explanation: The connection timed out. This often happens if the Neon compute endpoint is suspended/paused or if outbound traffic on port 5432 is blocked.");
    console.log("Action Required:");
    console.log(" 1. Check your Neon Dashboard to verify that the project is active (not paused) and the database compute is running.");
    console.log(" 2. Ensure that your database, role/user, and branch still exist.");
    console.log(" 3. Try adding '?connect_timeout=30' to your DATABASE_URL to allow additional time for Neon to wake up.");
    console.log(" 4. Verify that your firewall or network allows outgoing traffic to port 5432.");
  } else if (isConnRefused) {
    console.log("Category: Connection Refused");
    console.log("Explanation: The database server refused the connection.");
    console.log("Action Required:");
    console.log(" 1. Check if the database host and port are correct in your connection string.");
    console.log(" 2. Verify on the Neon Dashboard that your compute endpoint is currently active.");
  } else {
    console.log("Category: General Connection or Authentication Failure");
    console.log("Explanation: Connection failed due to authentication issues or incorrect configuration.");
    console.log("Action Required:");
    console.log(" 1. Verify that your database username, password, and database name are correct.");
    console.log(" 2. Make sure SSL mode is enabled (DATABASE_URL should end with '?sslmode=require').");
    console.log(" 3. Confirm that the Neon project role/user password is current and matches the connection string.");
  }
  console.log("=============================================================\n");

  process.exit(1);
}

async function connectDatabase() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("[database] PostgreSQL connected successfully.");
  } catch (error) {
    console.error(
      "[database] PostgreSQL connection failed:",
      error instanceof Error ? error.message : "Unknown database error"
    );

    console.error(
      "[database] Check DATABASE_URL, Neon project status, SSL mode, database, role, branch, and network access."
    );

    throw error;
  }
}

async function startServer() {
  try {
    console.log("[database] Connecting to PostgreSQL...");

    // Confirm that the hostname resolves from Node.js
    if (dbDetails) {
      await verifyDns(dbDetails.hostname);
    }

    // Verify database connection using standard pg client
    await db.query("SELECT 1");

    // Run database migrations
    await runMigration();

    // Verify database connection on startup using Prisma
    await connectDatabase();

    // Clean up pre-existing orphan ticket records in the database
    const { cleanOrphanTicketsAndOrders } = require("./utils/orphanTicketCleaner");
    await cleanOrphanTicketsAndOrders();

    app.listen(PORT, () => {
      console.log(`[Eventizers Backend] Server is running on port ${PORT}`);
    });
  } catch (error) {
    handleConnectionError(error);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;


