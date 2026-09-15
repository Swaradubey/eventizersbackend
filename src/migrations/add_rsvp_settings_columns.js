require("dotenv").config();
const db = require("../config/db");

async function migrate() {
  try {
    console.log("Running migration to add RSVP settings columns...");
    await db.query(`
      ALTER TABLE rsvp_settings
        ADD COLUMN IF NOT EXISTS rsvp_deadline_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS rsvp_deadline_date TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS allow_late_rsvp BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS allow_maybe BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS is_private_guest_list BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS allow_plus_one BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS max_additional_guests INTEGER DEFAULT 1;
    `);

    console.log("Columns successfully added / ensured.");

    // Check columns
    const res = await db.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'rsvp_settings'
      ORDER BY ordinal_position;
    `);
    console.log("Current columns on rsvp_settings table:", res.rows);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
