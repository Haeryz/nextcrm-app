const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
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

console.log(`Customer mode: http://${hostname}:${port}/customer`);

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
