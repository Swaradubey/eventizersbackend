const db = require("../config/db");

/**
 * Find user by email
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
const findUserByEmail = async (email) => {
  const result = await db.query(
    "SELECT id, name, email, password_hash AS password, created_at AS \"createdAt\" FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Find user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
const findUserById = async (id) => {
  const result = await db.query(
    "SELECT id, name, email, password_hash AS password, created_at AS \"createdAt\" FROM users WHERE id = $1",
    [parseInt(id, 10)]
  );
  return result.rows[0] || null;
};

/**
 * Create a new user in the database
 * @param {Object} userData
 * @param {string} userData.name
 * @param {string} userData.email
 * @param {string} userData.password
 * @returns {Promise<Object>}
 */
const createUser = async ({ name, email, password }) => {
  const result = await db.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at AS \"createdAt\"",
    [name, email, password]
  );
  return result.rows[0];
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
};
