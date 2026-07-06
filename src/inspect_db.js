require("dotenv").config();
const db = require("./config/db");

async function check() {
  try {
    const columnsRes = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log("Columns in 'users' table:", columnsRes.rows);

    const usersRes = await db.query(`SELECT * FROM users LIMIT 2;`);
    console.log("Sample rows in 'users' table:", usersRes.rows);

    const subUsageCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'SubscriptionUsage';
    `);
    console.log("Columns in 'SubscriptionUsage' table:", subUsageCols.rows);

    const pmCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_methods';
    `);
    console.log("Columns in 'payment_methods' table:", pmCols.rows);

    const invCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoices';
    `);
    console.log("Columns in 'invoices' table:", invCols.rows);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    process.exit(0);
  }
}

check();






