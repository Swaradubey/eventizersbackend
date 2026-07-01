const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is missing!");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}

const app = require("./app");
const prisma = require("./config/prisma");
const db = require("./config/db");

const PORT = process.env.PORT || 5000;

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

async function startServer() {
  try {
    console.log("[database] Connecting to PostgreSQL...");
    // Verify database connection using standard pg client
    await db.query("SELECT 1");

    // Run database migrations
    await runMigration();

    // Verify database connection on startup using Prisma (keeping existing functionality)
    await prisma.$connect();
    console.log("[database] PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(`[Eventizers Backend] Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[database] PostgreSQL connection failed");
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;

