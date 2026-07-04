const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}
const portArgIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
const inlinePortArg = args.find((arg) => arg.startsWith("--port="));
const hostnameArgIndex = args.findIndex(
  (arg) => arg === "--hostname" || arg === "-H"
);
const inlineHostnameArg = args.find((arg) => arg.startsWith("--hostname="));

const port =
  inlinePortArg?.split("=")[1] ||
  (portArgIndex >= 0 ? args[portArgIndex + 1] : undefined) ||
  process.env.PORT ||
  "3000";
const hostname =
  inlineHostnameArg?.split("=")[1] ||
  (hostnameArgIndex >= 0 ? args[hostnameArgIndex + 1] : undefined) ||
  "localhost";

const baseUrl = `http://${hostname}:${port}`;
console.log("");
console.log("NextCRM (Mektek) dev entry points:");
console.log(`  Customer: ${baseUrl}/customer`);
console.log(`  Staff:    ${baseUrl}/mektek`);
console.log(`  Admin:    ${baseUrl}/mektek/dashboard`);
console.log("");

const devCachePath = path.join(process.cwd(), ".next", "dev");
if (process.env.NEXTCRM_KEEP_DEV_CACHE !== "true") {
  try {
    fs.rmSync(devCachePath, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Could not clear ${devCachePath}. Stop any running dev server and retry.`
    );
    console.warn(error);
  }
}

execFileSync("pnpm", ["exec", "prisma", "generate"], {
  stdio: "inherit",
  env: process.env,
});

try {
  execFileSync(process.execPath, [path.resolve(process.cwd(), "scripts/ensure-whatsapp-browser.js")], {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  console.warn(
    "Could not ensure the WhatsApp Chrome binary. Continuing to start the dev server anyway; WhatsApp sending will be unavailable until it is installed."
  );
  console.warn(error?.message ?? error);
}

const nextBin = path.resolve(process.cwd(), "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
