import argon2 from "argon2";
import bcrypt from "bcrypt";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

const isArgon2Hash = (encoded: string) => encoded.startsWith("$argon2id$");
const isBcryptHash = (encoded: string) => /^\$2[aby]\$/.test(encoded);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  try {
    if (isArgon2Hash(encoded)) {
      const valid = await argon2.verify(encoded, password);
      return {
        valid,
        needsRehash: valid && argon2.needsRehash(encoded, ARGON2_OPTIONS),
      };
    }

    if (isBcryptHash(encoded)) {
      const valid = await bcrypt.compare(password, encoded);
      return { valid, needsRehash: valid };
    }
  } catch {
    // Treat malformed or unsupported hashes exactly like an invalid password.
  }

  return { valid: false, needsRehash: false };
}
