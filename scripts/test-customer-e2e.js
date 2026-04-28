const { spawn } = require("child_process");

const port = process.env.PLAYWRIGHT_PORT || "3107";
const env = {
  ...process.env,
  PLAYWRIGHT_PORT: port,
  PLAYWRIGHT_BASE_URL: `http://localhost:${port}`,
  PLAYWRIGHT_DEV_COMMAND: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
  PLAYWRIGHT_REUSE_EXISTING: "false",
};

const playwrightCli = require.resolve("@playwright/test/cli");
const child = spawn(
  process.execPath,
  [
    playwrightCli,
    "test",
    "tests/e2e/customer-catalog.spec.ts",
    "--project=customer-chromium",
  ],
  {
    stdio: "inherit",
    env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
