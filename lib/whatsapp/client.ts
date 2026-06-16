import type { Client } from "whatsapp-web.js";
import { LocalAuth, Client as WhatsAppClient } from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "fs";
import os from "os";
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
  sessionPhone?: string;
  lastQrAt?: string;
  lastError?: string;
};

declare global {
  var whatsappClient: Client | undefined;
  var whatsappState: WhatsAppState | undefined;
}

type WhatsAppWidLike = {
  user?: unknown;
  _serialized?: unknown;
};

type WhatsAppClientInfoLike = {
  wid?: WhatsAppWidLike;
};

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

function getClientSessionPhone(client?: Client): string | undefined {
  const info = (client as (Client & { info?: WhatsAppClientInfoLike }) | undefined)?.info;
  const user = info?.wid?.user;
  if (typeof user === "string" && user) return user;

  const serialized = info?.wid?._serialized;
  if (typeof serialized === "string" && serialized) {
    return serialized.split("@")[0];
  }

  return undefined;
}

export function getWhatsAppState(): WhatsAppState {
  const state = getStateRef();
  if (state.status === "ready" && !state.sessionPhone) {
    const sessionPhone = getClientSessionPhone(globalThis.whatsappClient);
    if (sessionPhone) setState({ sessionPhone });
  }

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
    setState({
      status: "ready",
      qrDataUrl: undefined,
      sessionPhone: getClientSessionPhone(client),
      lastError: undefined,
    });
  });

  client.on("auth_failure", (message: string) => {
    setState({ status: "auth_failure", sessionPhone: undefined, lastError: message });
  });

  client.on("disconnected", (reason: string) => {
    setState({ status: "disconnected", sessionPhone: undefined, lastError: reason });
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
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), ".cache", "puppeteer");
  if (!cacheDir) return undefined;

  const chromeRoot = path.join(cacheDir, "chrome");
  if (!fs.existsSync(chromeRoot)) return undefined;

  const platformCandidates = getChromePlatformCandidates();
  for (const candidate of platformCandidates) {
    const chromePath = findLatestChromeForPlatform(chromeRoot, candidate.prefix, candidate.executablePath);
    if (chromePath) return chromePath;
  }

  return undefined;
}

function getChromePlatformCandidates(): Array<{ prefix: string; executablePath: string[] }> {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? [
          {
            prefix: "mac_arm-",
            executablePath: [
              "chrome-mac-arm64",
              "Google Chrome for Testing.app",
              "Contents",
              "MacOS",
              "Google Chrome for Testing",
            ],
          },
          {
            prefix: "mac-",
            executablePath: [
              "chrome-mac-x64",
              "Google Chrome for Testing.app",
              "Contents",
              "MacOS",
              "Google Chrome for Testing",
            ],
          },
        ]
      : [
          {
            prefix: "mac-",
            executablePath: [
              "chrome-mac-x64",
              "Google Chrome for Testing.app",
              "Contents",
              "MacOS",
              "Google Chrome for Testing",
            ],
          },
        ];
  }

  if (process.platform === "win32") {
    return [
      { prefix: "win64-", executablePath: ["chrome-win64", "chrome.exe"] },
      { prefix: "win32-", executablePath: ["chrome-win32", "chrome.exe"] },
    ];
  }

  return [{ prefix: "linux-", executablePath: ["chrome-linux64", "chrome"] }];
}

function findLatestChromeForPlatform(
  chromeRoot: string,
  directoryPrefix: string,
  executablePath: string[]
): string | undefined {
  const candidates = fs
    .readdirSync(chromeRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith(directoryPrefix))
    .map((dirent) => dirent.name)
    .sort();

  if (!candidates.length) return undefined;

  for (const candidate of candidates.reverse()) {
    const chromePath = path.join(chromeRoot, candidate, ...executablePath);
    if (fs.existsSync(chromePath)) return chromePath;
  }

  return undefined;
}
