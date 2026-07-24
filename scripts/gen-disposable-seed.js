/* One-off generator for the BlockedEmailDomain seed migration.
 * Run: node scripts/gen-disposable-seed.js
 * Reads the disposable-email-domains npm package and emits a migration SQL
 * file that bulk-inserts every domain with source = 'seed'.
 */
const fs = require("fs");
const path = require("path");

const raw = require("disposable-email-domains");
const list = Array.isArray(raw) ? raw : raw.default || [];

const seen = new Set();
const cleaned = [];
for (const d of list) {
  const lower = String(d).toLowerCase().trim();
  if (!lower || seen.has(lower)) continue;
  seen.add(lower);
  cleaned.push(lower);
}

function esc(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const CHUNK = 1000;
const lines = [];
lines.push("-- Seed disposable/temp email domain blocklist from the disposable-email-domains npm package.");
lines.push("-- source = 'seed'. Admin CRUD and auto-bounce additions happen at runtime.");
lines.push("");

for (let i = 0; i < cleaned.length; i += CHUNK) {
  const slice = cleaned.slice(i, i + CHUNK);
  const values = slice.map(
    (d) =>
      "(gen_random_uuid(), " +
      esc(d) +
      ", 'seed', CURRENT_TIMESTAMP)"
  );
  lines.push(
    'INSERT INTO "BlockedEmailDomain" ("id", "domain", "source", "createdAt") VALUES'
  );
  lines.push("  " + values.join(",\n  ") + ";");
  lines.push("");
}

const out = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260724160100_email_service_seed",
  "migration.sql"
);
fs.writeFileSync(out, lines.join("\n") + "\n");
console.error("count=" + cleaned.length + " written=" + out);
