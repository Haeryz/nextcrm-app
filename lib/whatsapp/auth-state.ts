import "server-only";
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from "baileys";
import { prismadb } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { WHATSAPP_SESSION_SLUG } from "@/lib/whatsapp/lease";

// Baileys' AuthenticationState backed by Postgres instead of the filesystem.
//
// The bundled useMultiFileAuthState writes a directory of JSON files, which is
// useless here twice over: serverless has no writable persistent disk, and even if
// it did, the next invocation runs on a different instance. Baileys explicitly
// documents the file store as demo-only and expects production to bring its own.
//
// Everything is encrypted at rest: creds are the account, and the Signal keys are
// the material that decrypts/authenticates its traffic.

type SignalDataType = keyof SignalDataTypeMap;

/**
 * Guards against lib/prisma.ts's mock client, which is returned when DATABASE_URL
 * is unset and resolves every write to null instead of throwing. A swallowed
 * credential write is uniquely nasty here: pairing appears to succeed, then the
 * session is gone on the next request, which reads as a mysterious re-pairing loop
 * rather than the config error it actually is. So we check writes landed.
 */
function assertWrote<T>(result: T, what: string): NonNullable<T> {
  if (result === null || result === undefined) {
    throw new Error(
      `WhatsApp ${what} did not persist. Is DATABASE_URL set? ` +
        "(lib/prisma.ts falls back to a mock client that silently discards writes.)"
    );
  }
  return result as NonNullable<T>;
}

async function getSessionRow() {
  const row = await prismadb.whatsAppSession.findUnique({
    where: { slug: WHATSAPP_SESSION_SLUG },
  });
  return assertWrote(row, "session lookup");
}

/** Serialises Buffers the way Baileys expects. Its BufferJSON is the only correct
 *  codec here — plain JSON.stringify would turn keys into `{type:"Buffer",data:[…]}`
 *  and Baileys would hand WhatsApp garbage. */
async function serialise(value: unknown): Promise<string> {
  const { BufferJSON } = await import("baileys");
  return encryptSecret(JSON.stringify(value, BufferJSON.replacer));
}

async function deserialise<T>(cipher: string): Promise<T> {
  const { BufferJSON } = await import("baileys");
  return JSON.parse(decryptSecret(cipher), BufferJSON.reviver) as T;
}

export type WhatsAppAuthStore = {
  state: AuthenticationState;
  /** Persists creds. Must be awaited before the socket is torn down. */
  saveCreds: () => Promise<void>;
  /** True when credentials already existed (i.e. no QR scan needed). */
  hadCreds: boolean;
  sessionId: string;
};

/**
 * Loads (or initialises) the WhatsApp auth state from Postgres.
 *
 * Named `load…` rather than mirroring Baileys' `useMultiFileAuthState`: a `use`
 * prefix makes React's rules-of-hooks lint treat it as a hook, which it very much
 * is not.
 *
 * Signal keys are read per-request rather than cached across invocations because
 * each invocation is a fresh process anyway; the caller wraps this in Baileys'
 * makeCacheableSignalKeyStore so a single connection's repeated reads stay in memory.
 */
export async function loadPostgresAuthState(): Promise<WhatsAppAuthStore> {
  const { initAuthCreds } = await import("baileys");

  const session = await getSessionRow();
  const sessionId = session.id;

  let creds: AuthenticationCreds;
  let hadCreds = false;

  if (session.credsCipher) {
    try {
      creds = await deserialise<AuthenticationCreds>(session.credsCipher);
      hadCreds = true;
    } catch (error) {
      // A wrong/rotated EMAIL_ENCRYPTION_KEY lands here. Don't silently re-pair
      // over it — that would destroy a session that a correct key could still read.
      throw new Error(
        "Stored WhatsApp credentials could not be decrypted. If EMAIL_ENCRYPTION_KEY " +
          "was changed, restore the previous value or log out and re-pair. " +
          `(${error instanceof Error ? error.message : String(error)})`
      );
    }
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    assertWrote(
      await prismadb.whatsAppSession.update({
        where: { id: sessionId },
        data: { credsCipher: await serialise(creds) },
      }),
      "credentials"
    );
  };

  return {
    sessionId,
    hadCreds,
    saveCreds,
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const rows = await prismadb.whatsAppSignalKey.findMany({
            where: { sessionId, type, keyId: { in: ids } },
          });

          const byId = new Map(rows.map((row) => [row.keyId, row.valCipher]));
          const result: { [id: string]: SignalDataTypeMap[typeof type] } = {};

          for (const id of ids) {
            const cipher = byId.get(id);
            if (!cipher) continue;

            let value = await deserialise<SignalDataTypeMap[typeof type]>(cipher);
            if (type === "app-state-sync-key" && value) {
              // Baileys expects this one back as a protobuf message rather than the
              // plain object JSON gives us; without re-wrapping, app-state sync
              // throws when it reads the key.
              const { proto } = await import("baileys");
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as object
              ) as unknown as SignalDataTypeMap[typeof type];
            }
            result[id] = value;
          }

          return result;
        },

        set: async (data) => {
          const writes: Promise<unknown>[] = [];

          for (const [type, entries] of Object.entries(data)) {
            if (!entries) continue;

            for (const [keyId, value] of Object.entries(entries)) {
              if (value === null || value === undefined) {
                // Baileys signals deletion with null — e.g. a consumed pre-key.
                writes.push(
                  prismadb.whatsAppSignalKey.deleteMany({
                    where: { sessionId, type, keyId },
                  })
                );
                continue;
              }

              writes.push(
                serialise(value).then((valCipher) =>
                  prismadb.whatsAppSignalKey.upsert({
                    where: {
                      sessionId_type_keyId: {
                        sessionId,
                        type: type as SignalDataType,
                        keyId,
                      },
                    },
                    update: { valCipher },
                    create: { sessionId, type, keyId, valCipher },
                  })
                )
              );
            }
          }

          await Promise.all(writes);
        },
      },
    },
  };
}

/** Reads session status without touching credentials or opening a socket. */
export async function readWhatsAppSessionRow() {
  return getSessionRow();
}

/** Clears the paired session. Signal keys cascade via the FK. */
export async function clearWhatsAppAuthState(reason: string): Promise<void> {
  const session = await getSessionRow();
  await prismadb.whatsAppSignalKey.deleteMany({ where: { sessionId: session.id } });
  await prismadb.whatsAppSession.update({
    where: { id: session.id },
    data: {
      credsCipher: null,
      status: "not_linked",
      sessionPhone: null,
      linkedAt: null,
      lastQrAt: null,
      lastError: reason,
    },
  });
}
