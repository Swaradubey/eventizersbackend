const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

/**
 * Singleton Prisma client — cached on `globalThis` so it survives
 * Vercel warm invocations and avoids exhausting the connection pool.
 *
 * connect_timeout=5 in the datasource URL makes Prisma fail fast
 * (within 5 seconds) rather than hanging until Vercel's 60 s timeout.
 */
function buildPrismaClient() {
  const baseUrl = process.env.DATABASE_URL || "";
  // Inject connect_timeout only if not already present
  let datasourceUrl = baseUrl;
  if (baseUrl && !baseUrl.includes("connect_timeout")) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    datasourceUrl = `${baseUrl}${sep}connect_timeout=5`;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: datasourceUrl || undefined,
  });
}

const prisma = globalForPrisma.prisma || buildPrismaClient();

// Always cache Prisma instance globally to prevent connection leaks across serverless warm invocations
globalForPrisma.prisma = prisma;

module.exports = prisma;
