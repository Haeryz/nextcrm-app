import { prismadb } from "@/lib/prisma";
import {
  AUDIENCE_SCAN_LIMIT,
  MAX_RECIPIENTS_PER_SEND,
  buildEmailAudienceWhere,
  countAudience,
  describeMektekEmailAudience,
  explainEmptyAudience,
  filterByFrequencyCap,
  readFrequencyCap,
  resolveEmailAudience,
  validateMektekEmailAudience,
  type MektekEmailAudience,
} from "@/lib/mektek/email-audience";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    catalogCustomer: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    blockedEmailDomain: {
      findMany: jest.fn(),
    },
    emailLog: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const customerCount = prismadb.catalogCustomer.count as unknown as jest.Mock;
const customerFindMany = prismadb.catalogCustomer.findMany as unknown as jest.Mock;
const blockedFindMany = prismadb.blockedEmailDomain.findMany as unknown as jest.Mock;
const emailLogGroupBy = prismadb.emailLog.groupBy as unknown as jest.Mock;

const ALL: MektekEmailAudience = {
  scope: "ALL",
  customerType: null,
  customerId: null,
};

type CustomerRow = {
  id: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    userLanguage: string;
    emailPreference: { frequencyCaps: unknown } | null;
  } | null;
};

function customerRow(over: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "customer-1",
    user: {
      id: "user-1",
      email: "budi@example.com",
      name: "Budi",
      userLanguage: "id",
      emailPreference: { frequencyCaps: null },
    },
    ...over,
  };
}

/**
 * The DB predicate excludes walk-ins, staff and opted-out users, so a realistic
 * unit test has to assert BOTH: (a) the predicate is shaped so Postgres filters
 * them out, and (b) anything that still slips through the query is dropped in
 * memory before it reaches sendBulkEmails.
 */
function seed(rows: CustomerRow[], blockedDomains: string[] = []) {
  customerCount.mockResolvedValue(rows.length);
  customerFindMany.mockResolvedValue(rows);
  blockedFindMany.mockResolvedValue(blockedDomains.map((domain) => ({ domain })));
  emailLogGroupBy.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  seed([]);
});

describe("validateMektekEmailAudience", () => {
  it("accepts ALL without extra fields", () => {
    expect(validateMektekEmailAudience({ scope: "ALL" })).toEqual({
      data: { scope: "ALL", customerType: null, customerId: null },
    });
  });

  it("requires a valid customer type for CUSTOMER_TYPE", () => {
    expect(validateMektekEmailAudience({ scope: "CUSTOMER_TYPE" })).toEqual({
      error: "Tipe Customer wajib dipilih",
    });
    expect(
      validateMektekEmailAudience({ scope: "CUSTOMER_TYPE", customerType: "VIP" }),
    ).toEqual({ error: "Tipe Customer wajib dipilih" });
    expect(
      validateMektekEmailAudience({ scope: "CUSTOMER_TYPE", customerType: "B2B" }),
    ).toEqual({
      data: { scope: "CUSTOMER_TYPE", customerType: "B2B", customerId: null },
    });
  });

  it("requires a customer id for CUSTOMER", () => {
    expect(validateMektekEmailAudience({ scope: "CUSTOMER" })).toEqual({
      error: "Customer tujuan wajib dipilih",
    });
    expect(
      validateMektekEmailAudience({ scope: "CUSTOMER", customerId: " abc " }),
    ).toEqual({
      data: { scope: "CUSTOMER", customerType: null, customerId: "abc" },
    });
  });

  it("rejects an unknown scope", () => {
    expect(validateMektekEmailAudience({ scope: "EVERYONE" })).toEqual({
      error: "Target penerima tidak valid",
    });
    expect(validateMektekEmailAudience(undefined)).toEqual({
      error: "Target penerima tidak valid",
    });
  });
});

describe("buildEmailAudienceWhere", () => {
  it("uses `user: { is: ... }` so walk-ins (userId null) can never match", () => {
    const where = buildEmailAudienceWhere(ALL, "marketing");
    // A bare `user: {...}` filter on a nullable to-one relation also matches
    // rows where the relation is missing. `is` is what excludes walk-ins.
    expect(where.user).toHaveProperty("is");
    expect(where.user).not.toBeNull();
  });

  it("excludes staff, admins and non-active users", () => {
    const where = buildEmailAudienceWhere(ALL, "marketing");
    const user = (where.user as { is: Record<string, unknown> }).is;
    expect(user.is_admin).toBe(false);
    expect(user.mektekRole).toBeNull();
    expect(user.staffDivision).toBeNull();
    expect(user.logisticsStaffArea).toBeNull();
    expect(user.userStatus).toBe("ACTIVE");
  });

  it("excludes synthesized phone-only addresses", () => {
    const where = buildEmailAudienceWhere(ALL, "marketing");
    const user = (where.user as { is: Record<string, unknown> }).is;
    expect(user.NOT).toEqual({
      email: { endsWith: "@phone.nextcrm.local" },
    });
  });

  it("requires opt-in and absence of opt-out, per channel", () => {
    const marketing = buildEmailAudienceWhere(ALL, "marketing");
    const marketingUser = (marketing.user as { is: Record<string, unknown> }).is;
    expect(marketingUser.emailPreference).toEqual({
      is: { marketingOptedInAt: { not: null }, marketingOptedOutAt: null },
    });

    const offers = buildEmailAudienceWhere(ALL, "offers");
    const offersUser = (offers.user as { is: Record<string, unknown> }).is;
    expect(offersUser.emailPreference).toEqual({
      is: { offersOptedInAt: { not: null }, offersOptedOutAt: null },
    });
  });

  it("narrows by customer type and by single customer", () => {
    expect(
      buildEmailAudienceWhere(
        { scope: "CUSTOMER_TYPE", customerType: "B2B", customerId: null },
        "marketing",
      ).customerType,
    ).toBe("B2B");

    expect(
      buildEmailAudienceWhere(
        { scope: "CUSTOMER", customerType: null, customerId: "cust-9" },
        "offers",
      ).id,
    ).toBe("cust-9");

    expect(buildEmailAudienceWhere(ALL, "marketing").customerType).toBeUndefined();
    expect(buildEmailAudienceWhere(ALL, "marketing").id).toBeUndefined();
  });
});

describe("resolveEmailAudience suppression", () => {
  it("returns opted-in customers with a real email", async () => {
    seed([customerRow()]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toEqual([
      { userId: "user-1", email: "budi@example.com", username: "Budi", userLanguage: "id" },
    ]);
    expect(resolved.eligible).toBe(1);
    expect(resolved.sendableNow).toBe(1);
    expect(resolved.skipped).toBe(0);
  });

  it("drops a walk-in row (user null) that somehow reaches the resolver", async () => {
    seed([customerRow({ id: "walkin", user: null })]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(0);
    expect(resolved.reasons.invalidEmail).toBe(1);
    expect(resolved.skipped).toBe(1);
  });

  it("drops synthesized @phone.nextcrm.local addresses", async () => {
    seed([
      customerRow({
        user: {
          id: "user-2",
          email: "628123456789@phone.nextcrm.local",
          name: "Walk-in",
          userLanguage: "id",
          emailPreference: { frequencyCaps: null },
        },
      }),
    ]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(0);
    expect(resolved.reasons.invalidEmail).toBe(1);
  });

  it("drops addresses whose domain is blocked", async () => {
    seed([customerRow()], ["example.com"]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(0);
    expect(resolved.reasons.blockedDomain).toBe(1);
  });

  it("drops recipients already at their frequency cap", async () => {
    seed([customerRow()]);
    emailLogGroupBy.mockResolvedValue([{ userId: "user-1", _count: { _all: 4 } }]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(0);
    expect(resolved.reasons.frequencyCap).toBe(1);
  });

  it("keeps a recipient still under their cap", async () => {
    seed([customerRow()]);
    emailLogGroupBy.mockResolvedValue([{ userId: "user-1", _count: { _all: 3 } }]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(1);
    expect(resolved.reasons.frequencyCap).toBe(0);
  });

  it("dedupes users so nobody receives the same campaign twice", async () => {
    seed([customerRow({ id: "a" }), customerRow({ id: "b" })]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(1);
  });

  it("caps the batch and reports how many are left", async () => {
    const rows = Array.from({ length: MAX_RECIPIENTS_PER_SEND + 5 }, (_, index) =>
      customerRow({
        id: `customer-${index}`,
        user: {
          id: `user-${index}`,
          email: `user${index}@example.com`,
          name: `User ${index}`,
          userLanguage: "id",
          emailPreference: { frequencyCaps: null },
        },
      }),
    );
    seed(rows);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.recipients).toHaveLength(MAX_RECIPIENTS_PER_SEND);
    expect(resolved.remaining).toBe(5);
    expect(resolved.eligible).toBe(MAX_RECIPIENTS_PER_SEND + 5);
  });

  it("counts rows beyond the scan limit as remaining, never as sent", async () => {
    customerCount.mockResolvedValue(AUDIENCE_SCAN_LIMIT + 300);
    customerFindMany.mockResolvedValue([customerRow()]);
    blockedFindMany.mockResolvedValue([]);
    emailLogGroupBy.mockResolvedValue([]);
    const resolved = await resolveEmailAudience({ audience: ALL, channel: "marketing" });
    expect(resolved.matched).toBe(AUDIENCE_SCAN_LIMIT + 300);
    expect(resolved.scanned).toBe(1);
    expect(resolved.remaining).toBe(AUDIENCE_SCAN_LIMIT + 299);
  });

  it("scopes the DB query to one customer for CUSTOMER targeting", async () => {
    seed([customerRow()]);
    await resolveEmailAudience({
      audience: { scope: "CUSTOMER", customerType: null, customerId: "cust-9" },
      channel: "offers",
    });
    expect(customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "cust-9" }),
      }),
    );
  });
});

describe("countAudience", () => {
  it("previews the same numbers as the send without exposing addresses", async () => {
    seed([customerRow()]);
    const summary = await countAudience({ audience: ALL, channel: "marketing" });
    expect(summary.sendableNow).toBe(1);
    expect(summary).not.toHaveProperty("recipients");
  });

  it("reports zero for an empty opt-in list", async () => {
    seed([]);
    const summary = await countAudience({ audience: ALL, channel: "marketing" });
    expect(summary.sendableNow).toBe(0);
    expect(explainEmptyAudience(summary)).toContain("opt-in");
  });
});

describe("filterByFrequencyCap", () => {
  it("issues one aggregate per distinct cap window, not one per user", async () => {
    emailLogGroupBy.mockResolvedValue([]);
    await filterByFrequencyCap(
      [
        { userId: "a", caps: null },
        { userId: "b", caps: null },
        { userId: "c", caps: { marketing: { maxPerWindow: 2, windowHours: 24 } } },
      ],
      "marketing",
    );
    expect(emailLogGroupBy).toHaveBeenCalledTimes(2);
  });

  it("treats a zero/negative cap as no cap", async () => {
    const allowed = await filterByFrequencyCap(
      [{ userId: "a", caps: { marketing: { maxPerWindow: 0 } } }],
      "marketing",
    );
    expect(allowed.has("a")).toBe(true);
    expect(emailLogGroupBy).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  it("defaults to 4 per 7 days", () => {
    expect(readFrequencyCap(null, "marketing")).toEqual({
      maxPerWindow: 4,
      windowHours: 168,
    });
  });

  it("describes each targeting mode in Bahasa Indonesia", () => {
    expect(describeMektekEmailAudience(ALL)).toContain("Semua Customer");
    expect(
      describeMektekEmailAudience({
        scope: "CUSTOMER_TYPE",
        customerType: "B2B",
        customerId: null,
      }),
    ).toContain("B2B");
    expect(
      describeMektekEmailAudience(
        { scope: "CUSTOMER", customerType: null, customerId: "cust-9" },
        "Budi Santoso",
      ),
    ).toContain("Budi Santoso");
  });
});
