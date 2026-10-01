const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { newTemplatesDataBackend } = require('./src/config/new templates backend.js');
const templatesData = newTemplatesDataBackend;

async function seed() {
  try {
    console.log("Seeding canonical templates into database...");
    
    // Clear old templates if needed or upsert the 3 active templates
    for (const t of templatesData) {
      await prisma.template.upsert({
        where: { id: t.id },
        update: {
          name: t.name,
          category: t.category,
          content: t.content,
          isPremium: t.isPremium
        },
        create: {
          id: t.id,
          name: t.name,
          category: t.category,
          content: t.content,
          isPremium: t.isPremium
        }
      });
      console.log(`Upserted template: ${t.name} (${t.id})`);
    }

    const totalCount = await prisma.template.count();
    console.log(`\nSeeding completed successfully! Total templates in DB: ${totalCount}`);
  } catch (err) {
    console.error("Seeding templates failed:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();

module.exports = { templatesData };
