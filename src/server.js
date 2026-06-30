require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}
const fs = require("fs");
const path = require("path");
const app = require("./app");
const prisma = require("./config/prisma");
const db = require("./config/db");

const PORT = process.env.PORT || 5000;

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, "../migration.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    await db.query(sql);
    console.log("Database migration ran successfully (users table checked/created).");
  } catch (err) {
    console.error("Failed to run database migration:", err);
    throw err;
  }
}

async function startServer() {
  try {
    // Verify database connection using standard pg client
    await db.query("SELECT 1");
    console.log("Successfully connected to Neon PostgreSQL database (pg client).");

    // Run database migrations
    await runMigration();

    // Verify database connection on startup using Prisma (keeping existing functionality)
    await prisma.$connect();
    console.log("Successfully connected to the Neon PostgreSQL database (Prisma).");

    app.listen(PORT, () => {
      console.log(`[Eventizers Backend] Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the Neon PostgreSQL database:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;

