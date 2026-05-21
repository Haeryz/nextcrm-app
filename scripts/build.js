const { execSync } = require("child_process");
const path = require("path");

// Load .env files so DATABASE_URL is available when building locally.
// Priority: .env.local > .env (same as Next.js convention).
// dotenv.config is a no-op if the file doesn't exist.
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

function run(command) {
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

function shouldRunMigrations() {
  if (!hasDatabaseUrl()) {
    return false;
  }

  if (process.env.PRISMA_MIGRATE_ON_BUILD === "true") {
    return true;
  }

  return process.env.VERCEL !== "1";
}

run("pnpm exec prisma generate");

if (shouldRunMigrations()) {
  run("pnpm exec prisma migrate deploy");
} else if (hasDatabaseUrl()) {
  console.warn(
    "[build] Skipping prisma migrate deploy during Vercel build. Run migrations separately, or set PRISMA_MIGRATE_ON_BUILD=true to opt in."
  );
} else {
  console.warn("[build] Skipping prisma migrate deploy because DATABASE_URL is not set.");
}

run("pnpm exec next build");
