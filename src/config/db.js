const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

// Log any pool errors to prevent application crashes
pool.on("error", (err) => {
  console.error("[database] Unexpected error on idle client:", err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

