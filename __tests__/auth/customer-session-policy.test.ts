import {
  buildCustomerSessionCookie,
  buildCustomerSessionPolicy,
  hashCustomerSessionToken,
  isCustomerSessionExpired,
} from "@/lib/customer-session-policy";

describe("customer session policy", () => {
  const now = new Date("2026-07-15T00:00:00.000Z");

  it("uses a browser-session cookie by default with bounded server expiry", () => {
    const policy = buildCustomerSessionPolicy(false, now);

    expect(policy.cookieMaxAge).toBeUndefined();
    expect(policy.absoluteExpiresAt).toEqual(
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(policy.idleExpiresAt).toEqual(
      new Date("2026-07-15T02:00:00.000Z"),
    );
  });

  it("allows an explicitly remembered device for fourteen days", () => {
    const policy = buildCustomerSessionPolicy(true, now);

    expect(policy.cookieMaxAge).toBe(14 * 24 * 60 * 60);
    expect(policy.absoluteExpiresAt).toEqual(
      new Date("2026-07-29T00:00:00.000Z"),
    );
    expect(policy.idleExpiresAt).toEqual(
      new Date("2026-07-22T00:00:00.000Z"),
    );
  });

  it("uses a host-only HttpOnly secure cookie in production", () => {
    const cookie = buildCustomerSessionCookie(false, true, now);

    expect(cookie.name).toBe("__Host-mektek_customer_session");
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(cookie.options).not.toHaveProperty("domain");
    expect(cookie.options).not.toHaveProperty("maxAge");
  });

  it("sets persistent expiry only when the customer remembers the device", () => {
    const cookie = buildCustomerSessionCookie(true, true, now);

    expect(cookie.options.maxAge).toBe(14 * 24 * 60 * 60);
    expect(cookie.options.expires).toEqual(
      new Date("2026-07-29T00:00:00.000Z"),
    );
  });

  it("hashes opaque tokens deterministically without storing the raw token", () => {
    const rawToken = "a-private-random-session-token";
    const hash = hashCustomerSessionToken(rawToken);

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(rawToken);
    expect(hashCustomerSessionToken(rawToken)).toBe(hash);
  });

  it("expires a session at either its idle or absolute deadline", () => {
    const live = {
      idleExpiresAt: new Date("2026-07-15T02:00:00.000Z"),
      expiresAt: new Date("2026-07-15T12:00:00.000Z"),
      revokedAt: null,
    };

    expect(
      isCustomerSessionExpired(live, new Date("2026-07-15T01:59:59.000Z")),
    ).toBe(false);
    expect(
      isCustomerSessionExpired(live, new Date("2026-07-15T02:00:00.000Z")),
    ).toBe(true);
    expect(
      isCustomerSessionExpired(
        { ...live, revokedAt: new Date("2026-07-15T01:00:00.000Z") },
        new Date("2026-07-15T01:30:00.000Z"),
      ),
    ).toBe(true);
  });
});
