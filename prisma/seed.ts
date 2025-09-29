import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ✅ Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@ustp.edu.ph" },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    await prisma.user.create({
      data: {
        fullName: "System Admin",
        email: "admin@ustp.edu.ph",
        passwordHash,
        role: "admin",
        approved: true,
        emailVerified: true,
      },
    });

    console.log("✅ Admin user created:");
    console.log("   Email: admin@ustp.edu.ph");
    console.log("   Password: admin123");
  } else {
    console.log("⚠️ Admin already exists — skipping");
  }

  console.log("🌱 Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
