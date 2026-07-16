import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  phoneDigits,
  toWhatsAppChatId,
  toWhatsAppJid,
} from "@/lib/phone";

describe("normalizePhoneNumber", () => {
  it("collapses the three divergent Indonesian input forms to one E.164 value", () => {
    const canonical = "+6281234567890";
    expect(normalizePhoneNumber("0812-3456-7890")).toBe(canonical);
    expect(normalizePhoneNumber("62812 3456 7890")).toBe(canonical);
    expect(normalizePhoneNumber("+62 812-3456-7890")).toBe(canonical);
  });

  it("returns empty string for empty input", () => {
    expect(normalizePhoneNumber("")).toBe("");
    expect(normalizePhoneNumber("   ")).toBe("");
  });

  it("falls back to +digits for unparseable input without losing the number", () => {
    expect(normalizePhoneNumber("012345")).toBe("+6212345");
    expect(normalizePhoneNumber("+99 1234")).toBe("+991234");
  });
});

describe("isValidPhoneNumber", () => {
  it("accepts plausible Indonesian numbers", () => {
    expect(isValidPhoneNumber("0812-3456-7890")).toBe(true);
    expect(isValidPhoneNumber("+6281234567890")).toBe(true);
  });

  it("rejects obvious junk", () => {
    expect(isValidPhoneNumber("")).toBe(false);
    expect(isValidPhoneNumber("123")).toBe(false);
    expect(isValidPhoneNumber("abc")).toBe(false);
  });
});

describe("toWhatsAppChatId", () => {
  it("derives the chat id from the same canonical value the app stores", () => {
    expect(toWhatsAppChatId("0812-3456-7890")).toBe("6281234567890@c.us");
    expect(toWhatsAppChatId("+62 812 3456 7890")).toBe("6281234567890@c.us");
    // Matches phoneDigits(normalizePhoneNumber(...)) exactly.
    expect(toWhatsAppChatId("081234567890")).toBe(
      `${phoneDigits(normalizePhoneNumber("081234567890"))}@c.us`
    );
  });

  it("returns null for empty input", () => {
    expect(toWhatsAppChatId("")).toBeNull();
  });
});

describe("toWhatsAppJid", () => {
  it("derives the multi-device jid from the same canonical value the app stores", () => {
    expect(toWhatsAppJid("0812-3456-7890")).toBe("6281234567890@s.whatsapp.net");
    expect(toWhatsAppJid("+62 812 3456 7890")).toBe("6281234567890@s.whatsapp.net");
    // Matches phoneDigits(normalizePhoneNumber(...)) exactly.
    expect(toWhatsAppJid("081234567890")).toBe(
      `${phoneDigits(normalizePhoneNumber("081234567890"))}@s.whatsapp.net`
    );
  });

  it("returns null for empty input", () => {
    expect(toWhatsAppJid("")).toBeNull();
  });

  it("does not produce the legacy @c.us suffix", () => {
    // The two suffixes are not interchangeable: sending to a @c.us address over the
    // multi-device protocol silently fails to deliver, so this guards against the
    // drivers being wired to the wrong helper.
    const jid = toWhatsAppJid("081234567890");
    expect(jid).not.toContain("@c.us");
    expect(jid).not.toBe(toWhatsAppChatId("081234567890"));
  });
});
