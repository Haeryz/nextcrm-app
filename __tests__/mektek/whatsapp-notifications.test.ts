const getActiveTemplate = jest.fn();
const sendWhatsAppMessage = jest.fn();

jest.mock("@/lib/mektek/whatsapp-message-template-store", () => ({
  getActiveWhatsAppMessageTemplateBody: (...args: unknown[]) =>
    getActiveTemplate(...args),
}));

jest.mock("@/lib/external-apis", () => ({
  areExternalApisDisabled: () => false,
}));

jest.mock("@/lib/whatsapp", () => ({
  getWhatsAppState: async () => ({ status: "ready" }),
  sendWhatsAppMessage: (...args: unknown[]) => sendWhatsAppMessage(...args),
}));

jest.mock("@/actions/mektek/invoice-pdf", () => ({
  buildMektekInvoiceData: jest.fn(),
  renderMektekInvoicePdf: jest.fn(),
  renderMektekReceiptPdf: jest.fn(),
}));

import { notifyMektekOrderCreated } from "@/actions/mektek/whatsapp-notifications";

describe("Mektek WhatsApp notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendWhatsAppMessage.mockResolvedValue({ ok: true });
  });

  it("uses and interpolates the active user-created order template", async () => {
    getActiveTemplate.mockResolvedValue(
      "Hai {customerName}, {vehicle} bisa dilacak di {trackingLink}",
    );

    await notifyMektekOrderCreated({
      order: {
        id: "order-1",
        tags: {
          customerName: "Budi",
          vehicle: "Toyota Avanza",
          phone: "+628123456789",
        },
      },
      trackingLink: "https://mektek.test/id/s/abc",
    });

    expect(getActiveTemplate).toHaveBeenCalledWith("ORDER_CREATED");
    expect(sendWhatsAppMessage).toHaveBeenCalledWith({
      to: "+628123456789",
      message:
        "Hai Budi, Toyota Avanza bisa dilacak di https://mektek.test/id/s/abc",
    });
  });
});
