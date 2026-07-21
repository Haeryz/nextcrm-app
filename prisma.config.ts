import "dotenv/config";
import { defineConfig } from "prisma/config";

const configuredDatabaseUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

if (!configuredDatabaseUrl) {
  throw new Error(
    "DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL must be set",
  );
}

const migrationDatabaseUrl = new URL(configuredDatabaseUrl);

// Neon transaction pooling does not support the session advisory lock used by
// Prisma Migrate. Keep the application on DATABASE_URL while Prisma CLI uses a
// direct connection for schema operations.
if (migrationDatabaseUrl.hostname.includes("-pooler.")) {
  migrationDatabaseUrl.hostname = migrationDatabaseUrl.hostname.replace(
    "-pooler.",
    ".",
  );
}

if (!migrationDatabaseUrl.searchParams.has("schema")) {
  migrationDatabaseUrl.searchParams.set("schema", "public");
}

export default defineConfig({
  datasource: {
    url: migrationDatabaseUrl.toString(),
  },
  migrations: {
    seed: "npx tsx prisma/seeds/seed.ts",
  },
});
