import "server-only";
import type { WASocket } from "baileys";
import pino from "pino";
import { prismadb } from "@/lib/prisma";
import { toWhatsAppJid } from "@/lib/phone";
import { isSecretBoxConfigured } from "@/lib/crypto/secret-box";
import {
  clearWhatsAppAuthState,
  readWhatsAppSessionRow,
  loadPostgresAuthState,
} from "@/lib/whatsapp/auth-state";
import { withWhatsAppLease } from "@/lib/whatsapp/lease";
import type {
  WhatsAppSendParams,
  WhatsAppSendResult,
  WhatsAppState,
} from "@/lib/whatsapp/types";

// The Baileys transport: WhatsApp's multi-device protocol over a plain WebSocket.
// Full rationale, verification status and troubleshooting: docs/whatsapp-on-vercel.md
//
// The shape of this file is dictated by serverless. There is no long-lived socket
// and no in-memory session — every send opens a connection, does its work, and
// closes. That sounds wasteful, and it is (~3-8s per send), but it is the only
// shape that survives a platform which freezes and discards instances at will, and
// this app sends a handful of notifications a day.
//
// Deliberately NOT reusing a warm socket across invocations: WhatsApp permits one
// live connection per linked device, so two warm instances holding sockets on the
// same credentials would kick each other off (440 connectionReplaced) forever.
//
// ⚠️ UNPROVEN: everything past a QR scan — credentials persisting, the 515 reconnect
// below, sending, media — has never actually been executed, because it needs a
// physical phone to scan. Pairing up to and including a live QR is verified. If you
// are here because production misbehaves, start from that assumption and set
// WHATSAPP_LOG_LEVEL=debug.

const CONNECT_TIMEOUT_MS = 45_000;
const ACK_TIMEOUT_MS = 10_000;
const SEND_LEASE_TTL_MS = 90_000;
const SEND_LEASE_WAIT_MS = 25_000;

// Baileys logs at `info` by default, which would flood the function logs with
// protocol chatter on every send.
const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || "silent" });

type DisconnectLike = { output?: { statusCode?: number } };

function statusCodeOf(error: unknown): number | undefined {
  return (error as DisconnectLike | undefined)?.output?.statusCode;
}

/**
 * WhatsApp rejects clients it considers too old (405). The version bundled with
 * Baileys goes stale as the RC ages, so prefer the live one — but never let a
 * fetch failure block sending, since the bundled value is usually still fine.
 */
async function resolveVersion(): Promise<[number, number, number] | undefined> {
  try {
    const { fetchLatestBaileysVersion } = await import("baileys");
    const { version } = await fetchLatestBaileysVersion();
    return version;
  } catch {
    return undefined;
  }
}

type OpenResult = { sock: WASocket; loggedOut: boolean; error?: string };

/**
 * Opens a socket and resolves once it is usable.
 *
 * `onQr` is only supplied during pairing. Its absence means an unpaired session is
 * a hard error rather than something to wait on.
 */
async function openSocket(options: {
  onQr?: (qr: string) => void;
  onCredsSaved?: () => void;
  signal?: AbortSignal;
}): Promise<OpenResult> {
  const { default: makeWASocket, makeCacheableSignalKeyStore, Browsers } =
    await import("baileys");

  const store = await loadPostgresAuthState();
  const version = await resolveVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: store.state.creds,
      // Signal keys are read repeatedly within one connection; caching keeps that
      // in memory instead of hitting Postgres for each one.
      keys: makeCacheableSignalKeyStore(store.state.keys, logger),
    },
    logger,
    browser: Browsers.ubuntu("Chrome"),
    // Never pull chat history: we only send. Left on (the default) this would
    // download the account's entire history on every single send.
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    // Don't present as online — that would suppress notifications on the owner's
    // real phone for as long as we're connected.
    markOnlineOnConnect: false,
    // We never resend from history, so don't let Baileys ask us for old messages.
    getMessage: async () => undefined,
  });

  sock.ev.on("creds.update", async () => {
    await store.saveCreds();
    options.onCredsSaved?.();
  });

  return new Promise<OpenResult>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        sock.end(undefined);
        reject(new Error("Timed out waiting for WhatsApp connection"));
      });
    }, CONNECT_TIMEOUT_MS);

    const onAbort = () => {
      finish(() => {
        sock.end(undefined);
        reject(new Error("Aborted"));
      });
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    sock.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        if (!options.onQr) {
          // No credentials and nobody watching for a QR — the session simply is
          // not linked. Say so plainly instead of hanging until the timeout.
          finish(() => {
            sock.end(undefined);
            reject(new Error("WhatsApp is not linked. Pair a device first."));
          });
          return;
        }
        options.onQr(qr);
        return;
      }

      if (connection === "open") {
        finish(() => resolve({ sock, loggedOut: false }));
        return;
      }

      if (connection === "close") {
        const code = statusCodeOf(lastDisconnect?.error);

        // 515 is not a failure: WhatsApp always drops the socket immediately after
        // a successful pairing and expects a fresh connection using the credentials
        // it just issued. The caller reconnects.
        if (code === 515) {
          finish(() => resolve({ sock, loggedOut: false, error: "restart-required" }));
          return;
        }

        if (code === 401) {
          finish(() => resolve({ sock, loggedOut: true }));
          return;
        }

        finish(() => {
          sock.end(undefined);
          reject(
            new Error(
              lastDisconnect?.error?.message ||
                `WhatsApp connection closed (code ${code ?? "unknown"})`
            )
          );
        });
      }
    });
  });
}

/**
 * Connects a paired session, reconnecting once if WhatsApp asks for a restart.
 * Throws if the session is not linked.
 */
async function connectPaired(signal?: AbortSignal): Promise<WASocket> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await openSocket({ signal });

    if (result.loggedOut) {
      result.sock.end(undefined);
      await clearWhatsAppAuthState("WhatsApp reported this device was logged out.");
      throw new Error("WhatsApp device was logged out. Re-pair to continue.");
    }

    if (result.error === "restart-required") {
      result.sock.end(undefined);
      continue;
    }

    return result.sock;
  }

  throw new Error("WhatsApp asked for a restart twice; giving up.");
}

/**
 * Waits for the server to acknowledge a message before we tear the socket down.
 *
 * Without this, closing straight after sendMessage() resolves can drop the message
 * on the floor — it has been handed to the socket but not yet accepted. Best-effort:
 * a timeout here means "unconfirmed", not "failed", so we don't double-send.
 */
async function waitForAck(sock: WASocket, messageId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sock.ev.off("messages.update", onUpdate);
      resolve();
    }, ACK_TIMEOUT_MS);

    const onUpdate: Parameters<typeof sock.ev.on<"messages.update">>[1] = (updates) => {
      for (const { key, update } of updates) {
        // status >= 1 (SERVER_ACK) means WhatsApp has the message.
        if (key.id === messageId && (update.status ?? 0) >= 1) {
          clearTimeout(timer);
          sock.ev.off("messages.update", onUpdate);
          resolve();
          return;
        }
      }
    };

    sock.ev.on("messages.update", onUpdate);
  });
}

export async function getState(): Promise<WhatsAppState> {
  if (!isSecretBoxConfigured()) {
    return {
      status: "auth_failure",
      lastError:
        "EMAIL_ENCRYPTION_KEY is not configured, so the WhatsApp session cannot be stored.",
    };
  }

  try {
    const row = await readWhatsAppSessionRow();

    // There is no live socket to interrogate between invocations, so "linked"
    // means "we hold credentials". Whether WhatsApp still honours them is only
    // knowable by connecting; a revoked device surfaces as a 401 on the next send,
    // which flips this row to logged_out.
    const status: WhatsAppState["status"] = row.credsCipher
      ? "ready"
      : row.status === "auth_failure"
        ? "auth_failure"
        : "disconnected";

    return {
      status,
      sessionPhone: row.sessionPhone ?? undefined,
      lastQrAt: row.lastQrAt?.toISOString(),
      lastError: row.lastError ?? undefined,
    };
  } catch (error) {
    return {
      status: "auth_failure",
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function send(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  const jid = toWhatsAppJid(params.to);
  if (!jid) return { ok: false, error: "Invalid WhatsApp destination" };

  const outcome = await withWhatsAppLease(
    { ttlMs: SEND_LEASE_TTL_MS, waitMs: SEND_LEASE_WAIT_MS },
    async (): Promise<WhatsAppSendResult> => {
      let sock: WASocket | undefined;
      try {
        sock = await connectPaired();

        const text = await sock.sendMessage(jid, { text: params.message });
        if (text?.key.id) await waitForAck(sock, text.key.id);

        for (const item of params.media ?? []) {
          const sent = await sock.sendMessage(jid, {
            document: item.data,
            mimetype: item.mimeType,
            fileName: item.filename,
            caption: item.caption,
          });
          if (sent?.key.id) await waitForAck(sock, sent.key.id);
        }

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        // Always hang up. A leaked socket would hold the lease's worth of time and
        // then be killed with the instance anyway.
        sock?.end(undefined);
      }
    }
  );

  if (outcome.leaseBusy) {
    return { ok: false, error: "WhatsApp is busy with another message. Try again." };
  }
  return outcome.value;
}

export async function logout(): Promise<void> {
  const outcome = await withWhatsAppLease({ ttlMs: 30_000, waitMs: 5_000 }, async () => {
    let sock: WASocket | undefined;
    try {
      sock = await connectPaired();
      // Unlink properly so the device disappears from the phone's Linked Devices
      // list, rather than lingering as a dead entry.
      await sock.logout();
    } catch {
      // Already unreachable or unlinked — clearing local state below is still right.
    } finally {
      sock?.end(undefined);
    }
  });

  if (outcome.leaseBusy) {
    throw new Error("WhatsApp is busy. Try again in a moment.");
  }

  await clearWhatsAppAuthState("Logged out by an administrator.");
}

export type PairingEvent =
  | { type: "qr"; qr: string }
  | { type: "linked"; sessionPhone?: string }
  | { type: "error"; message: string };

/**
 * Runs an interactive pairing inside a single invocation, emitting events as they
 * happen. The caller streams these to the admin's browser over SSE.
 *
 * The whole flow must complete in one invocation because the socket cannot outlive
 * it — which is exactly why this is a stream and not a poll.
 */
export async function runPairing(options: {
  emit: (event: PairingEvent) => void;
  signal: AbortSignal;
  heartbeat: () => Promise<boolean>;
}): Promise<void> {
  const { emit, signal, heartbeat } = options;

  const session = await readWhatsAppSessionRow();
  await prismadb.whatsAppSession.update({
    where: { id: session.id },
    data: { status: "connecting", lastError: null },
  });

  // Keep the lease alive for as long as we hold the socket; without this a long
  // scan would let the lease lapse and a concurrent send could steal the connection.
  const beat = setInterval(() => {
    void heartbeat();
  }, 15_000);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await openSocket({
        signal,
        onQr: async (qr) => {
          emit({ type: "qr", qr });
          await prismadb.whatsAppSession
            .update({
              where: { id: session.id },
              data: { status: "qr", lastQrAt: new Date() },
            })
            .catch(() => {});
        },
      });

      if (result.loggedOut) {
        result.sock.end(undefined);
        await clearWhatsAppAuthState("WhatsApp rejected the pairing.");
        emit({ type: "error", message: "WhatsApp rejected the pairing. Try again." });
        return;
      }

      // Expected immediately after a successful scan — reconnect with the freshly
      // issued credentials rather than treating it as a failure.
      if (result.error === "restart-required") {
        result.sock.end(undefined);
        continue;
      }

      const sessionPhone = result.sock.user?.id?.split(":")[0]?.split("@")[0];
      await prismadb.whatsAppSession.update({
        where: { id: session.id },
        data: {
          status: "ready",
          sessionPhone: sessionPhone ?? null,
          linkedAt: new Date(),
          lastError: null,
          lastQrAt: null,
        },
      });

      result.sock.end(undefined);
      emit({ type: "linked", sessionPhone });
      return;
    }

    emit({ type: "error", message: "WhatsApp asked for a restart twice; giving up." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!signal.aborted) {
      await prismadb.whatsAppSession
        .update({
          where: { id: session.id },
          data: { status: "auth_failure", lastError: message },
        })
        .catch(() => {});
      emit({ type: "error", message });
    }
  } finally {
    clearInterval(beat);
  }
}
