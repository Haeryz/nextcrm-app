import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("MekTek order detail responsive UI", () => {
  const pageSource = readSource(
    "app/[locale]/(routes)/mektek/[id]/page.tsx",
  );
  const containerSource = readSource(
    "app/[locale]/(routes)/components/ui/Container.tsx",
  );
  const headingSource = readSource("components/ui/heading.tsx");
  const editorSource = readSource(
    "app/[locale]/(routes)/mektek/[id]/_components/ServiceOrderItemsEditor.tsx",
  );
  const damageItemsSource = readSource(
    "app/[locale]/(routes)/mektek/_components/DamageItemsInput.tsx",
  );
  const statusSource = readSource(
    "app/[locale]/(routes)/mektek/[id]/_components/ServiceOrderStatusControl.tsx",
  );
  const paymentSource = readSource(
    "app/[locale]/(routes)/mektek/_components/PaymentCard.tsx",
  );
  const whatsappSource = readSource(
    "app/[locale]/(routes)/mektek/_components/WhatsAppComposer.tsx",
  );
  const loyaltySource = readSource(
    "app/[locale]/(routes)/mektek/_components/VisitDiscountCard.tsx",
  );

  it("keeps the page shell and long order values inside a narrow viewport", () => {
    expect(containerSource).toContain("min-w-0");
    expect(headingSource).toContain("break-words text-2xl");
    expect(headingSource).toContain("break-words py-1");
    expect(pageSource).toContain("min-w-0 space-y-4 sm:space-y-6");
    expect(pageSource).toContain("break-words text-xl");
    expect(pageSource).toContain("break-all font-mono");
  });

  it("does not squeeze the two item editors into narrow nested columns", () => {
    expect(editorSource).toContain('className="grid min-w-0 gap-4"');
    expect(editorSource).not.toContain("xl:grid-cols-2");
    expect(editorSource).toContain("w-full sm:w-auto");
    expect(damageItemsSource).toContain("p-3 shadow-xs sm:p-4");
    expect(damageItemsSource).toContain("flex-col gap-3 min-[420px]:flex-row");
  });

  it("stacks dense controls until they have enough horizontal room", () => {
    expect(statusSource).toContain("flex flex-col gap-2 sm:flex-row");
    expect(paymentSource).toContain(
      "flex flex-col gap-2 min-[360px]:flex-row",
    );
    expect(whatsappSource).toContain("flex flex-col gap-2 sm:flex-row");
  });

  it("allows loyalty tiers to wrap without colliding", () => {
    expect(loyaltySource).toMatch(
      /flex flex-col gap-0\.5[^"`]*min-\[360px\]:flex-row/,
    );
  });
});
