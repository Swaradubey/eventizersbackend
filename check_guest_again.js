const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query('SELECT g.*, e.created_by FROM guests g JOIN events e ON g.event_id = e.id WHERE g.id = $1', ['02ea9109-fef6-4221-a8ab-55715a963bdb']);
  console.log(result.rows);
  await pool.end();
}

main().catch(console.error);
