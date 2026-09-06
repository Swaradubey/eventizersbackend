const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query('SELECT g.*, e.created_by FROM guests g JOIN events e ON g.event_id = e.id WHERE g.id = $1', ['77072c1e-e5e6-46ea-89ca-93a4bf742464']);
  console.log(result.rows);
  await pool.end();
}

main().catch(console.error);
