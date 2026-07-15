import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path from "path";
import { hashPassword } from "../../lib/password-core";

// Load .env.local for test user credentials
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("-------- Seeding DB --------");

  // Seed test user for E2E testing.
  const testUserEmail = process.env.TEST_USER_EMAIL || "test@nextcrm.app";
  const testUserPassword =
    process.env.TEST_USER_PASSWORD || "Som3Co0lP4ssw0rd123!";

  const existingTestUser = await prisma.users.findUnique({
    where: { email: testUserEmail },
  });

  const hashedPassword = await hashPassword(testUserPassword);

  if (!existingTestUser) {
    await prisma.users.create({
      data: {
        email: testUserEmail,
        name: "Test User",
        password: hashedPassword,
        userStatus: "ACTIVE",
        is_admin: true,
        is_account_admin: true,
      },
    });
    console.log(`Test user created: ${testUserEmail}`);
  } else {
    // Update password and status to ensure it matches env vars
    await prisma.users.update({
      where: { email: testUserEmail },
      data: {
        password: hashedPassword,
        userStatus: "ACTIVE",
        is_admin: true,
        is_account_admin: true,
      },
    });
    console.log(`Test user updated: ${testUserEmail}`);
  }

  console.log("-------- Seed DB completed --------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
