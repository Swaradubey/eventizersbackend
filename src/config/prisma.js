const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
  });

// Always cache Prisma instance globally to prevent connection leaks across serverless warm invocations
globalForPrisma.prisma = prisma;

module.exports = prisma;
