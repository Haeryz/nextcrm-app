// The lease is what stops two serverless invocations opening a WhatsApp socket on
// the same credentials (which makes WhatsApp kick one off with 440
// connectionReplaced). It is pure compare-and-swap logic, so it is tested against
// an in-memory stand-in for the one row it touches rather than a live database.

type Row = { lockOwner: string | null; lockedUntil: Date | null };

const row: Row = { lockOwner: null, lockedUntil: null };

// Mimics `updateMany`'s contract for this one row: apply the write only if the
// where-clause matches, and report how many rows changed. That count is exactly
// what the lease relies on to decide who won.
const updateMany = jest.fn(
  async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
    const now = new Date();

    if ("lockOwner" in where && where.lockOwner !== row.lockOwner) {
      return { count: 0 };
    }

    if (Array.isArray(where.OR)) {
      const free =
        row.lockedUntil === null || row.lockedUntil.getTime() < now.getTime();
      if (!free) return { count: 0 };
    }

    Object.assign(row, data);
    return { count: 1 };
  }
);

jest.mock("@/lib/prisma", () => ({
  prismadb: { whatsAppSession: { updateMany: (args: never) => updateMany(args) } },
}));

import {
  acquireWhatsAppLease,
  withWhatsAppLease,
} from "@/lib/whatsapp/lease";

beforeEach(() => {
  row.lockOwner = null;
  row.lockedUntil = null;
  updateMany.mockClear();
});

describe("acquireWhatsAppLease", () => {
  it("grants the lease when the row is free", async () => {
    const lease = await acquireWhatsAppLease({ ttlMs: 1000 });
    expect(lease).not.toBeNull();
    expect(row.lockOwner).toBe(lease!.owner);
    expect(row.lockedUntil).toBeInstanceOf(Date);
  });

  it("refuses a second holder while the first lease is live", async () => {
    const first = await acquireWhatsAppLease({ ttlMs: 60_000 });
    expect(first).not.toBeNull();

    // The whole point: the second invocation must not get a socket.
    const second = await acquireWhatsAppLease({ ttlMs: 60_000 });
    expect(second).toBeNull();
    expect(row.lockOwner).toBe(first!.owner);
  });

  it("takes over a lease that has expired", async () => {
    const first = await acquireWhatsAppLease({ ttlMs: 60_000 });
    // Simulate the holder's invocation being killed mid-flight: nothing released
    // the lease, it simply aged out. Without takeover, sending would wedge forever.
    row.lockedUntil = new Date(Date.now() - 1);

    const second = await acquireWhatsAppLease({ ttlMs: 1000 });
    expect(second).not.toBeNull();
    expect(second!.owner).not.toBe(first!.owner);
  });

  it("releases so the next caller can acquire", async () => {
    const first = await acquireWhatsAppLease({ ttlMs: 60_000 });
    await first!.release();
    expect(row.lockOwner).toBeNull();

    expect(await acquireWhatsAppLease({ ttlMs: 1000 })).not.toBeNull();
  });

  it("does not let a superseded holder release someone else's lease", async () => {
    const first = await acquireWhatsAppLease({ ttlMs: 60_000 });
    row.lockedUntil = new Date(Date.now() - 1);
    const second = await acquireWhatsAppLease({ ttlMs: 60_000 });

    // The zombie finally finishes and cleans up — it must not free the lease the
    // new holder is actively using.
    await first!.release();
    expect(row.lockOwner).toBe(second!.owner);
  });

  it("reports a failed heartbeat once the lease has been taken over", async () => {
    const first = await acquireWhatsAppLease({ ttlMs: 60_000 });
    expect(await first!.heartbeat()).toBe(true);

    row.lockedUntil = new Date(Date.now() - 1);
    await acquireWhatsAppLease({ ttlMs: 60_000 });

    // Pairing uses this to notice it has lost the connection and bail out.
    expect(await first!.heartbeat()).toBe(false);
  });
});

describe("withWhatsAppLease", () => {
  it("runs the callback and always releases, even when it throws", async () => {
    await expect(
      withWhatsAppLease({ ttlMs: 1000 }, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(row.lockOwner).toBeNull();
  });

  it("reports contention instead of running the callback", async () => {
    await acquireWhatsAppLease({ ttlMs: 60_000 });

    const ran = jest.fn();
    const outcome = await withWhatsAppLease({ ttlMs: 1000 }, async () => ran());

    expect(outcome).toEqual({ leaseBusy: true });
    expect(ran).not.toHaveBeenCalled();
  });

  it("returns the callback value when it acquires", async () => {
    const outcome = await withWhatsAppLease({ ttlMs: 1000 }, async () => "sent");
    expect(outcome).toEqual({ leaseBusy: false, value: "sent" });
  });
});
