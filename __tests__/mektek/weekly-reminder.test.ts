import {
  buildMektekWeeklyReminderMessage,
  shouldSendMektekWeeklyReminder,
} from "@/lib/mektek/weekly-reminder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("weekly MekTek WhatsApp reminders", () => {
  const now = new Date("2026-07-22T02:00:00.000Z");

  it("sends only when no reminder was sent in the previous seven days", () => {
    expect(shouldSendMektekWeeklyReminder(undefined, now)).toBe(true);
    expect(shouldSendMektekWeeklyReminder("2026-07-15T02:00:00.000Z", now)).toBe(true);
    expect(shouldSendMektekWeeklyReminder("2026-07-16T02:00:00.000Z", now)).toBe(false);
  });

  it("builds a useful reminder with the customer tracking link", () => {
    const message = buildMektekWeeklyReminderMessage({
      customerName: "Dewi",
      vehicle: "Toyota Avanza",
      trackingLink: "https://example.com/id/service-status/123?token=secret",
    });
    expect(message).toContain("Dewi");
    expect(message).toContain("Toyota Avanza");
    expect(message).toContain("https://example.com/id/service-status/123?token=secret");
  });

  it("registers a secured weekly Vercel cron route", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
    expect(config.crons).toContainEqual({
      path: "/api/cron/mektek-weekly-reminders",
      schedule: "0 2 * * 1",
    });
    const route = readFileSync(
      resolve(process.cwd(), "app/api/cron/mektek-weekly-reminders/route.ts"),
      "utf8",
    );
    expect(route).toContain("CRON_SECRET");
    expect(route).toContain("Bearer ${secret}");
  });
});
