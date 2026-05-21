import "dotenv/config";
import { defineConfig } from "prisma/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "npx tsx prisma/seeds/seed.ts",
  },
});