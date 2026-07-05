/**
 * Re-normalize existing `phoneNormalized` columns to canonical E.164 (see
 * lib/phone.ts). Historically the app stored divergent forms (bare digits,
 * `+62…`, `0…`), so the same person could exist under several dedupe keys.
 *
 * Safety:
 *  - Dry-run by default. Pass `--apply` to write changes.
 *  - Updates are done one row at a time; if writing a row's new value would
 *    collide with an existing row (duplicate customer/user), the collision is
 *    REPORTED and skipped — never auto-merged, because merging touches foreign
 *    keys (catalogServiceLink, orders in tags) and must be reviewed by a human.
 *
 * Usage:
 *   node scripts/renormalize-phones.js            # dry run, prints what would change
 *   node scripts/renormalize-phones.js --apply    # write canonical values
 */
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const APPLY = process.argv.includes("--apply");
const DEFAULT_REGION = "ID";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Mirror of lib/phone.ts normalizePhoneNumber (kept in sync intentionally).
function normalizePhoneNumber(phone) {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "";
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_REGION);
  if (parsed && parsed.isValid()) return parsed.number;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (!hasPlus && digits.startsWith("0")) return `+62${digits.slice(1)}`;
  return `+${digits}`;
}

async function processModel(label, findMany, updateById) {
  const rows = await findMany();
  let changed = 0;
  let collisions = 0;
  const seen = new Map(); // canonical -> first row id we assigned it to

  for (const row of rows) {
    const canonical = normalizePhoneNumber(row.phoneNormalized || row.phone || "");
    if (!canonical || canonical === row.phoneNormalized) {
      if (canonical) seen.set(canonical, row.id);
      continue;
    }

    const existingOwner = seen.get(canonical);
    // Would this new value collide with another row's (unique) phoneNormalized?
    const conflict =
      existingOwner ||
      rows.find((r) => r.id !== row.id && r.phoneNormalized === canonical)?.id;

    if (conflict) {
      collisions += 1;
      console.log(
        `  [COLLISION] ${label} ${row.id} "${row.phoneNormalized}" -> "${canonical}" ` +
          `already used by ${conflict} (skipped — merge manually)`
      );
      continue;
    }

    console.log(`  ${label} ${row.id}: "${row.phoneNormalized}" -> "${canonical}"`);
    if (APPLY) await updateById(row.id, canonical);
    seen.set(canonical, row.id);
    changed += 1;
  }

  console.log(
    `${label}: ${changed} ${APPLY ? "updated" : "would change"}, ${collisions} collision(s) skipped.\n`
  );
  return { changed, collisions };
}

async function main() {
  console.log(APPLY ? "APPLYING changes...\n" : "DRY RUN (pass --apply to write)\n");

  await processModel(
    "CatalogCustomer",
    () =>
      prisma.catalogCustomer.findMany({
        select: { id: true, phone: true, phoneNormalized: true },
      }),
    (id, phoneNormalized) =>
      prisma.catalogCustomer.update({ where: { id }, data: { phoneNormalized } })
  );

  await processModel(
    "Users",
    () =>
      prisma.users.findMany({
        where: { phoneNormalized: { not: null } },
        select: { id: true, phone: true, phoneNormalized: true },
      }),
    (id, phoneNormalized) =>
      prisma.users.update({ where: { id }, data: { phoneNormalized } })
  );

  console.log(
    APPLY
      ? "Done. Review any COLLISION lines and merge those records by hand."
      : "Dry run complete. Re-run with --apply once the collision list looks acceptable."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
