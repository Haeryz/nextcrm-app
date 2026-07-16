import "server-only";
import type { Client } from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "fs";
import os from "os";
import path from "path";
import { toWhatsAppChatId } from "@/lib/phone";
import type {
  WhatsAppSendParams,
  WhatsAppSendResult,
  WhatsAppState,
} from "@/lib/whatsapp/types";

// The legacy whatsapp-web.js transport: a real Chromium driven by Puppeteer.
//
// LOCAL ONLY. It needs a writable session directory and a process that outlives a
// request, so it cannot work on serverless — see the guard in ../index.ts. Kept as
// an escape hatch while the Baileys driver proves itself; the Baileys driver is the
// default in every environment, including local dev, so this path is opt-in via
// WHATSAPP_DRIVER=wwebjs.

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

export async function getState(): Promise<WhatsAppState> {
  const state = getStateRef();
  if (state.status === "ready" && !state.sessionPhone) {
    const sessionPhone = getClientSessionPhone(globalThis.whatsappClient);
    if (sessionPhone) setState({ sessionPhone });
  }

  return { ...getStateRef() };
}

export async function getClient(): Promise<Client> {
  if (globalThis.whatsappClient) return globalThis.whatsappClient;

  // Import whatsapp-web.js (and, transitively, puppeteer/Chromium) lazily. A
  // top-level import would drag Chromium into every serverless function whose
  // import graph reaches this module (mektek/customer pages, the status route),
  // which crashes on Vercel's Node runtime. Loading it only when a session is
  // actually being started keeps those routes free of the browser dependency.
  const { LocalAuth, Client: WhatsAppClient } = await import("whatsapp-web.js");

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

export async function send(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  const client = await getClient();
  const state = await getState();
  if (state.status !== "ready") {
    return { ok: false, error: "WhatsApp session is not ready" };
  }

  const chatId = toWhatsAppChatId(params.to);
  if (!chatId) {
    return { ok: false, error: "Invalid WhatsApp destination" };
  }

  try {
    await client.sendMessage(chatId, params.message);

    if (params.media?.length) {
      const { MessageMedia } = await import("whatsapp-web.js");
      for (const item of params.media) {
        const media = new MessageMedia(
          item.mimeType,
          item.data.toString("base64"),
          item.filename
        );
        await client.sendMessage(chatId, media, {
          caption: item.caption,
          sendMediaAsDocument: true,
        });
      }
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function logout(): Promise<void> {
  const client = globalThis.whatsappClient;
  if (!client) return;

  try {
    await client.logout();
  } finally {
    await client.destroy().catch(() => {});
    globalThis.whatsappClient = undefined;
    globalThis.whatsappState = { ...defaultState };
  }
}

/** Streams the QR this driver has already produced. Unlike Baileys, whatsapp-web.js
 *  owns its own session lifecycle, so pairing here is just observing global state. */
export async function startPairing(): Promise<void> {
  await getClient();
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
