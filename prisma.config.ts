import "dotenv/config";
import { defineConfig } from "prisma/config";

const defaultDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/nextcrm?schema=public";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
  migrations: {
    seed: "npx tsx prisma/seeds/seed.ts",
  },
});
