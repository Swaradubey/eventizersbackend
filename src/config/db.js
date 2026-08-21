const { Pool } = require("pg");

const globalForPg = globalThis;

let pool = globalForPg.pgPool;

if (!pool) {
  const dbUrl = process.env.DATABASE_URL || "";
  const isNeon = dbUrl.includes("neon.tech");
  const isSslRequired = dbUrl.includes("sslmode=require") || isNeon || process.env.NODE_ENV === "production";

  pool = new Pool({
    connectionString: dbUrl || undefined,
    ssl: isSslRequired ? { rejectUnauthorized: false } : false,
    max: 10, // Prevent exhausting serverless database connection limits
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Log any pool errors to prevent application crashes
  pool.on("error", (err) => {
    console.error("[database] Unexpected error on idle pg client:", err.message);
  });

  globalForPg.pgPool = pool;
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

