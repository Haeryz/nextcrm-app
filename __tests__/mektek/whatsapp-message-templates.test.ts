import {
  applyWhatsAppMessageTemplate,
  validateWhatsAppMessageTemplateInput,
} from "@/lib/mektek/whatsapp-message-templates";

describe("WhatsApp message templates", () => {
  it("validates and normalizes a user-created template", () => {
    expect(
      validateWhatsAppMessageTemplateInput({
        name: "  Pengingat pembayaran  ",
        body: "  Halo {customerName}  ",
        purpose: "READY_FOR_PAYMENT",
        isActive: true,
      }),
    ).toEqual({
      data: {
        name: "Pengingat pembayaran",
        body: "Halo {customerName}",
        purpose: "READY_FOR_PAYMENT",
        isActive: true,
      },
    });
  });

  it("rejects empty and unsupported templates", () => {
    expect(
      validateWhatsAppMessageTemplateInput({
        name: "",
        body: "Isi",
        purpose: "ORDER_CREATED",
      }),
    ).toEqual({ error: "Nama template wajib diisi" });

    expect(
      validateWhatsAppMessageTemplateInput({
        name: "Template",
        body: "Isi",
        purpose: "UNKNOWN",
      }),
    ).toEqual({ error: "Jenis template tidak valid" });
  });

  it("replaces supported variables and removes unknown variables", () => {
    expect(
      applyWhatsAppMessageTemplate(
        "Halo {customerName}, status {vehicle}: {trackingLink} {unknown}",
        {
          customerName: "Budi",
          vehicle: "Avanza",
          trackingLink: "https://example.test/s/abc",
        },
      ),
    ).toBe("Halo Budi, status Avanza: https://example.test/s/abc ");
  });
});
