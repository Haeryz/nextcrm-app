import fs from "fs";
import path from "path";

describe("MekTek order detail", () => {
  it("does not fetch or render internal notes", () => {
    const pageSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/[id]/page.tsx",
      ),
      "utf8",
    );
    const actionSource = fs.readFileSync(
      path.join(process.cwd(), "actions/mektek/service-orders.ts"),
      "utf8",
    );

    expect(pageSource).not.toContain("Catatan Internal");
    expect(pageSource).not.toContain("order.comments");
    expect(actionSource).not.toMatch(
      /getMektekServiceOrderById[\s\S]*?comments:\s*\{/,
    );
  });
});
