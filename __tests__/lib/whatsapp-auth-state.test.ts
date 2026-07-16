// Covers the property the old whatsapp-web.js stack could never have: a WhatsApp
// session that survives the process it was created in. Real encryption, real
// storage logic, in-memory stand-ins for the two tables.
//
// Baileys itself is stubbed because it is ESM-only (`"type": "module"`, no CJS
// build) and this suite runs under ts-jest in CommonJS. Pulling it in would mean
// transforming it and its 2MB WASM bridge on every run. The stub keeps BufferJSON's
// actual contract — Buffers survive a JSON round-trip — which is what this module
// depends on; that the real codec honours that contract is confirmed by the live
// pairing flow, not here.

process.env.EMAIL_ENCRYPTION_KEY = "b".repeat(64);

jest.mock("baileys", () => ({
  // Same tagged-Buffer scheme the real BufferJSON uses.
  BufferJSON: {
    replacer(this: unknown, _key: string, value: unknown) {
      const v = value as { type?: string; data?: unknown };
      if (Buffer.isBuffer(value) || v?.type === "Buffer") {
        return {
          type: "Buffer",
          data: Buffer.from((v.data as never) ?? (value as never)).toString("base64"),
        };
      }
      return value;
    },
    reviver(_key: string, value: unknown) {
      const v = value as { type?: string; data?: string };
      if (v?.type === "Buffer" && typeof v.data === "string") {
        return Buffer.from(v.data, "base64");
      }
      return value;
    },
  },
  initAuthCreds: () => ({
    noiseKey: { private: Buffer.from("private-noise-key-material"), public: Buffer.from("pub") },
    signedIdentityKey: { private: Buffer.from("id-priv"), public: Buffer.from("id-pub") },
    registrationId: 12345,
    advSecretKey: "adv-secret",
    registered: false,
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
  }),
  proto: { Message: { AppStateSyncKeyData: { fromObject: (o: unknown) => o } } },
}));

type SessionRow = {
  id: string;
  slug: string;
  credsCipher: string | null;
  status: string;
  sessionPhone: string | null;
  lastError: string | null;
  lastQrAt: Date | null;
  linkedAt: Date | null;
};

type KeyRow = { sessionId: string; type: string; keyId: string; valCipher: string };

const session: SessionRow = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "default",
  credsCipher: null,
  status: "not_linked",
  sessionPhone: null,
  lastError: null,
  lastQrAt: null,
  linkedAt: null,
};

let keyRows: KeyRow[] = [];
let sessionExists = true;

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    whatsAppSession: {
      findUnique: async () => (sessionExists ? { ...session } : null),
      update: async ({ data }: { data: Partial<SessionRow> }) => {
        Object.assign(session, data);
        return { ...session };
      },
    },
    whatsAppSignalKey: {
      findMany: async ({ where }: { where: { type: string; keyId: { in: string[] } } }) =>
        keyRows.filter(
          (r) => r.type === where.type && where.keyId.in.includes(r.keyId)
        ),
      upsert: async ({ create }: { create: KeyRow }) => {
        keyRows = keyRows.filter(
          (r) => !(r.type === create.type && r.keyId === create.keyId)
        );
        keyRows.push(create);
        return create;
      },
      deleteMany: async ({ where }: { where: { type?: string; keyId?: string } }) => {
        keyRows = keyRows.filter(
          (r) => !(r.type === where.type && r.keyId === where.keyId)
        );
        return { count: 1 };
      },
    },
  },
}));

import { loadPostgresAuthState } from "@/lib/whatsapp/auth-state";
import {
  __resetSecretBoxKeyCacheForTests,
  encryptSecret,
} from "@/lib/crypto/secret-box";

beforeEach(() => {
  session.credsCipher = null;
  session.status = "not_linked";
  keyRows = [];
  sessionExists = true;
  // The key-rotation test swaps this out; restore it so test order can't matter.
  process.env.EMAIL_ENCRYPTION_KEY = "b".repeat(64);
  __resetSecretBoxKeyCacheForTests();
});

describe("loadPostgresAuthState", () => {
  it("initialises fresh credentials when nothing is stored", async () => {
    const store = await loadPostgresAuthState();
    expect(store.hadCreds).toBe(false);
    expect(store.state.creds.registered).toBe(false);
  });

  it("survives a restart: saved credentials reload byte-identically", async () => {
    const first = await loadPostgresAuthState();
    await first.saveCreds();

    expect(session.credsCipher).not.toBeNull();

    // A brand new load, as a different serverless invocation would do.
    const second = await loadPostgresAuthState();

    expect(second.hadCreds).toBe(true);
    expect(second.state.creds.registrationId).toBe(first.state.creds.registrationId);
    // Buffers must come back as Buffers, not {type:"Buffer",data:[…]} — this is what
    // Baileys' BufferJSON codec is for, and getting it wrong sends WhatsApp garbage.
    expect(Buffer.isBuffer(second.state.creds.noiseKey.private)).toBe(true);
    expect(
      Buffer.compare(
        second.state.creds.noiseKey.private,
        first.state.creds.noiseKey.private
      )
    ).toBe(0);
  });

  it("stores credentials encrypted, never as readable JSON", async () => {
    const store = await loadPostgresAuthState();
    await store.saveCreds();

    // Credentials are full send-as-the-business access; a DB dump must not reveal them.
    expect(session.credsCipher!.startsWith("v1.")).toBe(true);
    expect(session.credsCipher).not.toContain("noiseKey");
    expect(session.credsCipher).not.toContain("registrationId");
  });

  it("round-trips signal keys through the encrypted key store", async () => {
    const store = await loadPostgresAuthState();
    const value = { public: Buffer.from([1, 2, 3]), private: Buffer.from([4, 5, 6]) };

    await store.state.keys.set({ "pre-key": { "1": value } });
    expect(keyRows).toHaveLength(1);
    expect(keyRows[0].valCipher.startsWith("v1.")).toBe(true);

    const read = await store.state.keys.get("pre-key", ["1"]);
    expect(Buffer.isBuffer(read["1"].private)).toBe(true);
    expect(Buffer.compare(read["1"].private, value.private)).toBe(0);
  });

  it("omits keys it does not have rather than returning undefined entries", async () => {
    const store = await loadPostgresAuthState();
    const read = await store.state.keys.get("pre-key", ["missing"]);
    expect(read).toEqual({});
  });

  it("deletes a signal key when Baileys sets it to null", async () => {
    const store = await loadPostgresAuthState();
    await store.state.keys.set({
      "pre-key": { "1": { public: Buffer.from([1]), private: Buffer.from([2]) } },
    });
    expect(keyRows).toHaveLength(1);

    // Baileys signals a consumed pre-key this way.
    await store.state.keys.set({ "pre-key": { "1": null } });
    expect(keyRows).toHaveLength(0);
  });

  it("throws rather than silently discarding writes when the DB is a mock", async () => {
    // lib/prisma.ts hands back a mock client when DATABASE_URL is unset, and the
    // mock resolves reads/writes to null. Left unchecked that looks like a session
    // that pairs and then vanishes — an endless re-pairing loop rather than the
    // config error it really is.
    sessionExists = false;
    await expect(loadPostgresAuthState()).rejects.toThrow(/DATABASE_URL/);
  });

  it("refuses to re-pair over credentials it cannot decrypt", async () => {
    const store = await loadPostgresAuthState();
    await store.saveCreds();

    // Simulate EMAIL_ENCRYPTION_KEY having been rotated by re-encrypting the row
    // under a different key. (Corrupting the base64url text instead would be flaky:
    // base64 packs 4 chars into 3 bytes, so altering the last character often
    // decodes to the very same bytes and authenticates cleanly.)
    process.env.EMAIL_ENCRYPTION_KEY = "c".repeat(64);
    __resetSecretBoxKeyCacheForTests();
    session.credsCipher = encryptSecret(JSON.stringify({ registrationId: 999 }));

    process.env.EMAIL_ENCRYPTION_KEY = "b".repeat(64);
    __resetSecretBoxKeyCacheForTests();

    // The right answer is to stop and complain, not to wipe a session that the old
    // key could still read.
    await expect(loadPostgresAuthState()).rejects.toThrow(/EMAIL_ENCRYPTION_KEY/);
  });
});
