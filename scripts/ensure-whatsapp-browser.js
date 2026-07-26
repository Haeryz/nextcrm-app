const { execFileSync } = require("child_process");
const fs = require("fs");

// The wwebjs/Puppeteer driver is refused outright on Vercel (lib/whatsapp/index.ts),
// so downloading ~150-300MB of Chrome during a serverless/CI build is pure waste on
// every deploy. Local dev still installs it.
const isServerlessBuild =
  process.env.VERCEL === "1" || process.env.CI === "true";

const skipInstall =
  isServerlessBuild ||
  process.env.NEXTCRM_SKIP_WHATSAPP_BROWSER_INSTALL === "true" ||
  process.env.PUPPETEER_SKIP_DOWNLOAD === "true";

const explicitBrowserPath =
  process.env.WHATSAPP_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;

function getPuppeteerExecutablePath() {
  try {
    const puppeteer = require("puppeteer");
    return puppeteer.executablePath();
  } catch (error) {
    return undefined;
  }
}

function runPuppeteerInstall() {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  execFileSync(pnpm, ["exec", "puppeteer", "browsers", "install", "chrome"], {
    stdio: "inherit",
    env: process.env,
  });
}

if (skipInstall) {
  console.log("[whatsapp] Skipping Puppeteer Chrome install by environment setting.");
  process.exit(0);
}

if (explicitBrowserPath) {
  if (fs.existsSync(explicitBrowserPath)) {
    console.log(`[whatsapp] Using configured browser: ${explicitBrowserPath}`);
    process.exit(0);
  }

  console.warn(`[whatsapp] Configured browser was not found: ${explicitBrowserPath}`);
  console.warn("[whatsapp] Falling back to Puppeteer Chrome for Testing.");
}

const executablePath = getPuppeteerExecutablePath();
if (executablePath && fs.existsSync(executablePath)) {
  console.log(`[whatsapp] Puppeteer Chrome is installed: ${executablePath}`);
  process.exit(0);
}

console.log("[whatsapp] Installing Puppeteer Chrome for Testing for whatsapp-web.js...");
runPuppeteerInstall();
