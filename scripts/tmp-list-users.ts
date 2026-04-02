import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      userStatus: true,
      is_admin: true,
      lastLoginAt: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { created_on: "desc" }],
    take: 20,
  });

  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
