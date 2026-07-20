import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("manual timeline entry UI", () => {
  const formSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/[id]/_components/AddTimelineEntryForm.tsx",
    ),
    "utf8",
  );
  const detailSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/mektek/[id]/page.tsx"),
    "utf8",
  );
  const actionSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/service-orders.ts"),
    "utf8",
  );
  const publicTimelineSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/service-status/[id]/_components/LiveServiceStatus.tsx",
    ),
    "utf8",
  );
  const statusControlSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/[id]/_components/ServiceOrderStatusControl.tsx",
    ),
    "utf8",
  );

  it("only asks for the timeline description", () => {
    expect(formSource).toContain('placeholder="Contoh: Sparepart sudah dipasang"');
    expect(formSource).toContain('"Add Timeline"');
    expect(formSource).not.toMatch(/setStatus|SelectItem|completed:\s*status/);
    expect(formSource).not.toMatch(/>Done<|>Pending</);

    const addTimelineAction = actionSource.slice(
      actionSource.indexOf("export const addMektekTimelineEntry"),
      actionSource.indexOf("export const", actionSource.indexOf("export const addMektekTimelineEntry") + 1),
    );
    expect(addTimelineAction).not.toContain("completed");
  });

  it("does not render Done/Pending state on the order detail timeline", () => {
    expect(detailSource).not.toMatch(/timelineItem\.completed/);
    expect(detailSource).not.toMatch(/Step Done/);
    expect(detailSource).not.toMatch(/\?\s*"Done"\s*:\s*"Pending"/);
    expect(publicTimelineSource).not.toMatch(/item\.completed/);
    expect(publicTimelineSource).not.toMatch(/\?\s*"Done"\s*:\s*"Pending"/);
    expect(statusControlSource).not.toContain("markAllTimelineComplete");
    expect(statusControlSource).not.toContain("Tandai semua Timeline Step sebagai Done");
  });
});
