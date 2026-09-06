const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query('SELECT * FROM events WHERE id = $1', ['925d7640-9d96-46f6-9b3b-e7dcda1d041b']);
  console.log(result.rows);
  await pool.end();
}

main().catch(console.error);
