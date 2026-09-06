const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query('SELECT * FROM invitations WHERE created_by = 13 ORDER BY created_at DESC LIMIT 1');
  console.log(result.rows);
  await pool.end();
}

main().catch(console.error);
