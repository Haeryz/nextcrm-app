// Builds the migrator image's package.json from the root one.
//
// The migrator only runs `prisma migrate deploy` and
// `tsx scripts/bootstrap-admin.ts`. Installing the full app dependency tree
// (Next.js, Baileys, Puppeteer, …) plus a C++ toolchain made it a 2.6 GB image,
// bigger than the app itself, and every deploy has to pull it onto a 30 GB VPS.
// Each package is pinned to the exact version installed from the app's
// pnpm-lock.yaml (read from node_modules), so the migrator never drifts.
//
// Usage: node package-from-root.cjs <app dir> > package.json

const fs = require("node:fs");
const path = require("node:path");

const MIGRATOR_DEPENDENCIES = [
  // prisma.config.ts + `prisma migrate deploy` / `prisma generate`
  "prisma",
  "@prisma/client",
  "dotenv",
  // scripts/bootstrap-admin.ts
  "@prisma/adapter-pg",
  "pg",
  "tsx",
  // lib/password-core.ts
  "argon2",
  "bcrypt",
];

const appDir = process.argv[2];
const dependencies = {};
for (const name of MIGRATOR_DEPENDENCIES) {
  const manifest = path.join(appDir, "node_modules", name, "package.json");
  if (!fs.existsSync(manifest)) {
    console.error(`[migrator] ${name} is not installed in ${appDir}/node_modules`);
    process.exit(1);
  }
  dependencies[name] = JSON.parse(fs.readFileSync(manifest, "utf8")).version;
}

process.stdout.write(
  `${JSON.stringify(
    { name: "nextcrm-migrator", private: true, dependencies },
    null,
    2,
  )}\n`,
);
