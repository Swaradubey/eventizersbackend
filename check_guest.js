const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query('SELECT * FROM guests WHERE id = $1', ['692fb6cf-05d4-4d4f-95e8-8cce281eadc4']);
  console.log(result.rows);
  await pool.end();
}

main().catch(console.error);
