const prisma = require("../config/prisma");

/**
 * Find user by email
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

/**
 * Find user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
const findUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id: parseInt(id, 10) },
  });
};

/**
 * Create a new user in the database
 * @param {Object} userData
 * @param {string} userData.name
 * @param {string} userData.email
 * @param {string} userData.phoneNumber
 * @param {string} userData.password
 * @returns {Promise<Object>}
 */
const createUser = async ({ name, email, phoneNumber, password }) => {
  return await prisma.user.create({
    data: {
      name,
      email,
      phoneNumber,
      password,
    },
  });
};

/**
 * Update user's password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
const updateUserPassword = async (email, password) => {
  return await prisma.user.update({
    where: { email },
    data: { password },
  });
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
};

