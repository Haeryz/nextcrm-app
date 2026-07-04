import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const email = (
  process.env.NEXTCRM_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  ""
)
  .trim()
  .toLowerCase();
const password =
  process.env.NEXTCRM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const name = (
  process.env.NEXTCRM_ADMIN_NAME ||
  process.env.ADMIN_NAME ||
  "NextCRM Admin"
).trim();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to bootstrap the admin account");
}

if (!email || !email.includes("@")) {
  throw new Error("NEXTCRM_ADMIN_EMAIL must be a valid email address");
}

if (password.length < 12) {
  throw new Error("NEXTCRM_ADMIN_PASSWORD must be at least 12 characters");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hash(password, 12);

  const admin = await prisma.users.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      is_admin: true,
      is_account_admin: true,
      mektekRole: null,
      userStatus: "ACTIVE",
    },
    create: {
      email,
      name,
      password: passwordHash,
      avatar: "",
      account_name: "NextCRM Admin",
      is_admin: true,
      is_account_admin: true,
      mektekRole: null,
      userStatus: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      name: true,
      is_admin: true,
      userStatus: true,
    },
  });

  console.log(
    `Admin account bootstrapped: ${admin.email} (${admin.id}) status=${admin.userStatus}`
  );
}

main()
  .catch((error) => {
    console.error("[BOOTSTRAP_ADMIN]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
