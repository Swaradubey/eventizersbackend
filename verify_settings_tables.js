require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Test: find notification settings for admin user 9999
    const notif = await prisma.adminNotificationSettings.findUnique({ where: { userId: 9999 } });
    console.log('adminNotificationSettings.findUnique(userId=9999):', notif === null ? 'null (no row yet, but no crash!)' : JSON.stringify(notif));

    // Test: find admin profile for user 9999
    const profile = await prisma.adminProfile.findUnique({ where: { userId: 9999 } });
    console.log('adminProfile.findUnique(userId=9999):', profile === null ? 'null (no row yet, but no crash!)' : JSON.stringify(profile));

    // Test: find security settings for user 9999
    const security = await prisma.adminSecuritySettings.findUnique({ where: { userId: 9999 } });
    console.log('adminSecuritySettings.findUnique(userId=9999):', security === null ? 'null (no row yet, but no crash!)' : JSON.stringify(security));

    // Test: find preferences for user 9999
    const prefs = await prisma.adminPreferences.findUnique({ where: { userId: 9999 } });
    console.log('adminPreferences.findUnique(userId=9999):', prefs === null ? 'null (no row yet, but no crash!)' : JSON.stringify(prefs));

    console.log('\n✅ No P2021 errors! All settings tables are queryable correctly.');
    console.log('✅ The Settings page should now load without "Database Connection Issue".');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error('Code:', err.code);
  } finally {
    await prisma.$disconnect();
  }
}

main();
