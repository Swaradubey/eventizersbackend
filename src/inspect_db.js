require("dotenv").config();
const db = require("./config/db");

async function check() {
  try {
    const userRes = await db.query(`SELECT id, name, email FROM "User";`);
    console.log("Rows in 'User' table:", userRes.rows);

    const usersRes = await db.query(`SELECT id, name, email FROM users;`);
    console.log("Rows in 'users' table:", usersRes.rows);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    process.exit(0);
  }
}

check();






