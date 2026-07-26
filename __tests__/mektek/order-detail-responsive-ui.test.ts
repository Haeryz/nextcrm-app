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
    expect(pageSource).toContain("break-words text-lg");
    expect(pageSource).toContain("break-all font-mono");
  });

  it("does not squeeze the two item editors into narrow nested columns", () => {
    expect(editorSource).toContain('className="grid min-w-0 gap-5"');
    expect(editorSource).not.toContain("xl:grid-cols-2");
    expect(editorSource).toContain("w-full sm:w-auto");
    expect(damageItemsSource).toContain("p-3 shadow-xs sm:p-4");
    expect(damageItemsSource).toContain("flex-col gap-3 min-[420px]:flex-row");
  });

  it("gives the quantity stepper stable touch targets instead of a narrow column span", () => {
    expect(damageItemsSource).not.toContain("md:grid-cols-12");
    expect(damageItemsSource).toContain(
      "grid-cols-[2.75rem_minmax(4rem,1fr)_2.75rem]",
    );
    expect(damageItemsSource.match(/className="size-11 shrink-0"/g)).toHaveLength(
      2,
    );
    expect(damageItemsSource).toContain("h-11 min-w-0 text-center");
  });

  it("keeps critical order actions ahead of the item history on smaller screens", () => {
    // The aside carries Status / Jadwal / Pembayaran, so it must stack first on
    // phones — ahead of the detail cards and the long work history.
    expect(pageSource).toContain(
      "order-1 min-w-0 space-y-4",
    );
    expect(pageSource).toContain("order-2 border shadow-sm");
    expect(pageSource).toContain("order-3 border shadow-sm");
    expect(pageSource).toContain("order-4 border shadow-sm");
  });

  it("splits into two columns from lg instead of hiding the aside until 2xl", () => {
    expect(pageSource).toContain("lg:grid-cols-[minmax(0,1fr)_288px]");
    expect(pageSource).toContain("xl:grid-cols-[minmax(0,1fr)_352px]");
    expect(pageSource).toContain("2xl:grid-cols-[minmax(0,1fr)_400px]");
    // Grid placement utilities must follow the same breakpoint as the split.
    expect(pageSource).not.toMatch(/2xl:(col|row)-(start|span)/);
    expect(pageSource).toContain("lg:col-start-2 lg:row-span-3 lg:row-start-1");
  });

  it("pins the action aside only once there is a second column to pin it in", () => {
    expect(pageSource).toContain("lg:sticky lg:top-4");
    expect(pageSource).toContain("lg:max-h-[calc(100svh-2rem)]");
    expect(pageSource).toContain("lg:self-start");
    // A panel pinned below lg would eat the phone viewport.
    expect(pageSource).not.toMatch(/className="[^"]*\bsticky top-/);
  });

  it("stacks dense controls until they have enough horizontal room", () => {
    // The status control renders inside the pinned aside (288-400px), so a
    // viewport-based `sm:flex-row` would put its confirm/cancel pair side by
    // side in a column far too narrow for them. It stays stacked at every width.
    expect(statusSource).toContain("flex flex-col gap-1.5");
    expect(statusSource).not.toMatch(/sm:flex-row/);
    expect(statusSource).not.toMatch(/sm:grid-cols-2/);
    expect(paymentSource).toContain(
      "flex flex-col gap-2 min-[360px]:flex-row",
    );
    expect(whatsappSource).toContain("flex flex-col gap-2 sm:flex-row");
    expect(pageSource).toContain(
      "grid-cols-1 min-[480px]:grid-cols-3",
    );
  });

  it("allows loyalty tiers to wrap without colliding", () => {
    expect(loyaltySource).toMatch(
      /flex flex-col gap-0\.5[^"`]*min-\[360px\]:flex-row/,
    );
  });
});
