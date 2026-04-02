const { execSync } = require("child_process");

function run(command) {
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

run("pnpm exec prisma generate");

if (hasDatabaseUrl()) {
  run("pnpm exec prisma migrate deploy");
} else {
  console.warn("[build] Skipping prisma migrate deploy because DATABASE_URL is not set.");
}

run("pnpm exec next build");