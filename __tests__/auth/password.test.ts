import bcrypt from "bcrypt";

import { hashPassword, verifyPassword } from "@/lib/password-core";

describe("password storage", () => {
  it("stores and verifies new passwords with Argon2id", async () => {
    const encoded = await hashPassword("correct horse battery staple");

    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword("correct horse battery staple", encoded),
    ).resolves.toEqual({ valid: true, needsRehash: false });
    await expect(verifyPassword("wrong password", encoded)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it("accepts a legacy bcrypt password once and marks it for upgrade", async () => {
    const encoded = await bcrypt.hash("legacy password", 4);

    await expect(verifyPassword("legacy password", encoded)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });
});
