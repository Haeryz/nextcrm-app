import crypto from "crypto";

import {
  __resetSecretBoxKeyCacheForTests,
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  SecretKeyError,
} from "@/lib/crypto/secret-box";

const KEY_A = "a".repeat(64);
const KEY_B = crypto.randomBytes(32).toString("hex");

const withKey = (key: string | undefined) => {
  if (key === undefined) {
    delete process.env.EMAIL_ENCRYPTION_KEY;
  } else {
    process.env.EMAIL_ENCRYPTION_KEY = key;
  }
  __resetSecretBoxKeyCacheForTests();
};

describe("secret-box", () => {
  const original = process.env.EMAIL_ENCRYPTION_KEY;

  afterEach(() => {
    withKey(original);
  });

  it("round-trips a value", () => {
    withKey(KEY_A);
    const plaintext = JSON.stringify({ noiseKey: "abc", registered: true });
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it("produces a different ciphertext each time for the same input", () => {
    withKey(KEY_A);
    // A fresh IV per call: identical WhatsApp credentials must not produce an
    // identical row, or the database leaks when two values are the same.
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("round-trips unicode and empty strings", () => {
    withKey(KEY_A);
    expect(decryptSecret(encryptSecret(""))).toBe("");
    expect(decryptSecret(encryptSecret("halo → 👋 émoji"))).toBe("halo → 👋 émoji");
  });

  it("refuses a key that is not 64 hex chars", () => {
    withKey("too-short");
    expect(() => encryptSecret("x")).toThrow(SecretKeyError);
  });

  it("refuses a missing key rather than silently storing plaintext", () => {
    withKey(undefined);
    expect(isSecretBoxConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(SecretKeyError);
  });

  it("reports whether a usable key is configured", () => {
    withKey(KEY_A);
    expect(isSecretBoxConfigured()).toBe(true);
  });

  it("fails loudly when decrypted with the wrong key", () => {
    withKey(KEY_A);
    const payload = encryptSecret("secret");
    withKey(KEY_B);
    // A rotated key must throw, not return garbage — the auth store relies on this
    // to tell "wrong key" apart from "no session yet" instead of wiping a session
    // that the correct key could still read.
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("rejects a tampered ciphertext", () => {
    withKey(KEY_A);
    const payload = encryptSecret("secret");
    const [version, iv, tag, ciphertext] = payload.split(".");
    const flipped = Buffer.from(ciphertext, "base64url");
    flipped[0] ^= 0xff;
    const tampered = [version, iv, tag, flipped.toString("base64url")].join(".");

    // GCM's auth tag is what makes this throw rather than decrypt to junk.
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects a malformed payload", () => {
    withKey(KEY_A);
    expect(() => decryptSecret("nonsense")).toThrow(SecretKeyError);
    expect(() => decryptSecret("v2.a.b.c")).toThrow(SecretKeyError);
  });
});
