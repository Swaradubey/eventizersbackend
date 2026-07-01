const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "hexerve@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "12345";

  console.log(`Checking if admin user exists with email: ${adminEmail}`);

  // Find admin user by email
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    console.log("Admin user not found. Creating admin user...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        password: hashedPassword, // maps to password_hash in DB via prisma
        role: "ADMIN",
      },
    });

    console.log(`Admin user created successfully with ID: ${admin.id}`);
  } else {
    console.log("Admin user already exists. Updating role and password to ensure credentials align...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: "ADMIN",
        password: hashedPassword,
      },
    });
    console.log("Admin user updated successfully.");
  }
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
