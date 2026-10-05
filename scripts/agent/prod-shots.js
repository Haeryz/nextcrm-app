/**
 * Logs in to production as the test admin and saves proof screenshots for a
 * client fix (see CLAUDE.md "Client fix → proof workflow"). Read-only: it only
 * navigates and captures, never clicks save/submit.
 *
 *   node scripts/agent/prod-shots.js shots.json
 *
 * shots.json:
 *   {
 *     "slug": "payment-faktur-total",
 *     "shots": [
 *       { "name": "1-ringkasan", "path": "/mektek/finance", "waitFor": "Piutang terbuka" },
 *       { "name": "2-baris", "path": "/mektek/finance/payment-faktur?q=MTL0191126",
 *         "waitFor": "MTL0191126", "element": "table" }
 *     ]
 *   }
 * `path` is relative to /en. `element` captures just that CSS selector;
 * `fullPage: true` captures the whole page. Output goes to
 * PROOF_DIR/<YYYY-MM-DD>-<slug>/<name>.png.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "..", "..");

function loadEnv() {
  const file = path.join(root, ".env.agent.local");
  if (!fs.existsSync(file)) {
    throw new Error("Missing .env.agent.local — copy scripts/agent/env.example and fill it in.");
  }
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && !line.trimStart().startsWith("#")) {
      env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
  return env;
}

/**
 * `{ "name": "...", "xlsx": "/api/...export?month=2026-09", "sheet": 1, "rows": 25,
 *    "pick": ["No", "Nama Customer"] }` (`pick` optional: only those columns)
 * downloads an Excel export with the logged-in session (GET only), saves the
 * file next to the screenshots, and screenshots its first rows as a table.
 * `xlsx` is relative to the site origin (API routes have no locale).
 */
async function captureWorkbook(page, base, shot, outDir) {
  const XLSX = require("xlsx");
  const origin = new URL(base).origin;
  const response = await page.request.get(`${origin}${shot.xlsx}`);
  if (!response.ok()) throw new Error(`${shot.xlsx} → HTTP ${response.status()}`);
  const buffer = await response.body();
  fs.writeFileSync(path.join(outDir, `${shot.name}.xlsx`), buffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[shot.sheet ?? 0];
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: true,
  });
  // Keep only the named header columns (in that order) and the first rows.
  const indexes = Array.isArray(shot.pick)
    ? shot.pick.map((name) => grid[0].indexOf(name)).filter((i) => i >= 0)
    : grid[0].map((_, i) => i).slice(0, shot.cols ?? 18);
  const visible = grid
    .slice(0, (shot.rows ?? 25) + 1)
    .map((row) => indexes.map((i) => row[i] ?? ""));
  const table = XLSX.utils.sheet_to_html(XLSX.utils.aoa_to_sheet(visible));
  await page.setContent(`<style>
    body{font:13px Calibri,Arial,sans-serif;margin:16px}
    h3{margin:0 0 8px}
    table{border-collapse:collapse}
    td{border:1px solid #d0d7de;padding:3px 8px;white-space:nowrap;height:18px}
    tr:first-child td{background:#e7f0e9;font-weight:bold}
  </style><div id="sheet" style="display:inline-block"><h3>${sheetName}</h3>${table.replace(/^[\s\S]*?<table/, "<table").replace(/<\/table>[\s\S]*$/, "</table>")}</div>`);
  const file = path.join(outDir, `${shot.name}.png`);
  await page.locator("#sheet").screenshot({ path: file });
  console.log("saved", file);
}

async function main() {
  const specFile = process.argv[2];
  if (!specFile) throw new Error("usage: node scripts/agent/prod-shots.js shots.json");
  const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const env = loadEnv();
  const base = `${(env.PROD_URL || "https://mektek.id").replace(/\/$/, "")}/en`;
  const day = new Date().toISOString().slice(0, 10);
  const outDir = path.join(
    env.PROOF_DIR || path.join(root, "proof"),
    `${day}-${spec.slug || "fix"}`,
  );
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', env.PROD_TEST_EMAIL);
    await page.fill('input[type="password"]', env.PROD_TEST_PASSWORD);
    await page.locator("button[type=submit]").first().click();
    await page
      .waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 60_000 })
      .catch(async (error) => {
        await page.screenshot({ path: path.join(outDir, "login-failed.png") });
        throw error;
      });

    for (const shot of spec.shots) {
      if (shot.xlsx) {
        await captureWorkbook(page, base, shot, outDir);
        continue;
      }
      await page.goto(`${base}${shot.path}`, { waitUntil: "domcontentloaded" });
      if (shot.waitFor) {
        await page.getByText(shot.waitFor).first().waitFor({ timeout: 90_000 });
      }
      await page.waitForTimeout(shot.settleMs ?? 2500);
      const file = path.join(outDir, `${shot.name}.png`);
      if (shot.element) {
        await page.locator(shot.element).first().screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: Boolean(shot.fullPage) });
      }
      console.log("saved", file);
    }
  } finally {
    await browser.close();
  }
  console.log("PROOF_FOLDER", outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
