import type { Client } from "whatsapp-web.js";
import { LocalAuth, Client as WhatsAppClient } from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";

export type WhatsAppSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "ready"
  | "auth_failure";

export type WhatsAppState = {
  status: WhatsAppSessionStatus;
  qrDataUrl?: string;
  lastQrAt?: string;
  lastError?: string;
};

declare global {
  var whatsappClient: Client | undefined;
  var whatsappState: WhatsAppState | undefined;
}

const defaultState: WhatsAppState = { status: "disconnected" };

function getStateRef(): WhatsAppState {
  if (!globalThis.whatsappState) {
    globalThis.whatsappState = { ...defaultState };
  }
  return globalThis.whatsappState;
}

function setState(patch: Partial<WhatsAppState>) {
  Object.assign(getStateRef(), patch);
}

export function getWhatsAppState(): WhatsAppState {
  return { ...getStateRef() };
}

export function getWhatsAppClient(): Client {
  if (globalThis.whatsappClient) return globalThis.whatsappClient;

  const authPath = process.env.WHATSAPP_SESSION_PATH || ".wwebjs_auth";
  const executablePath =
    process.env.WHATSAPP_CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    findPuppeteerChrome();
  const client = new WhatsAppClient({
    authStrategy: new LocalAuth({ clientId: "nextcrm", dataPath: authPath }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      ...(executablePath ? { executablePath } : {}),
    },
  });

  setState({ status: "connecting", lastError: undefined });

  client.on("qr", async (qr: string) => {
    try {
      const dataUrl = await qrcode.toDataURL(qr);
      setState({ status: "qr", qrDataUrl: dataUrl, lastQrAt: new Date().toISOString() });
    } catch (error) {
      setState({
        status: "qr",
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  });

  client.on("authenticated", () => {
    setState({ status: "connecting", lastError: undefined });
  });

  client.on("ready", () => {
    setState({ status: "ready", qrDataUrl: undefined, lastError: undefined });
  });

  client.on("auth_failure", (message: string) => {
    setState({ status: "auth_failure", lastError: message });
  });

  client.on("disconnected", (reason: string) => {
    setState({ status: "disconnected", lastError: reason });
  });

  client.initialize().catch((error) => {
    setState({
      status: "disconnected",
      lastError: error instanceof Error ? error.message : String(error),
    });
  });

  globalThis.whatsappClient = client;
  return client;
}

function findPuppeteerChrome(): string | undefined {
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(process.env.USERPROFILE || "", ".cache", "puppeteer");
  if (!cacheDir) return undefined;

  const chromeRoot = path.join(cacheDir, "chrome");
  if (!fs.existsSync(chromeRoot)) return undefined;

  const candidates = fs
    .readdirSync(chromeRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("win64-"))
    .map((dirent) => dirent.name)
    .sort();

  if (!candidates.length) return undefined;

  const latest = candidates[candidates.length - 1];
  const chromePath = path.join(chromeRoot, latest, "chrome-win64", "chrome.exe");
  return fs.existsSync(chromePath) ? chromePath : undefined;
}
