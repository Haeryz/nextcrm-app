import { areExternalApisDisabled } from "@/lib/external-apis";
import { sendTransactionalEmail } from "@/lib/email";
import { reserveEmailOtpSend } from "@/lib/email/otp-send-guard";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { issueEmailOtpCode } from "@/lib/email-otp";

import { requestCustomerEmailOtp } from "@/actions/auth/email-otp";

// The email OTP request must FAIL CLOSED in production (no reachable inbox means
// no verification, therefore no signup) while staying testable in dev, where the
// code is logged to the server console instead. Same shape the WhatsApp OTP path
// has always had.

jest.mock("@/lib/external-apis", () => ({
  areExternalApisDisabled: jest.fn(() => false),
}));

jest.mock("@/lib/email", () => ({
  sendTransactionalEmail: jest.fn(async () => ({ ok: true, providerId: "e1" })),
}));

jest.mock("@/lib/email-otp", () => ({
  issueEmailOtpCode: jest.fn(async () => "123456"),
}));

jest.mock("@/lib/email/otp-send-guard", () => ({
  reserveEmailOtpSend: jest.fn(async () => ({ ok: true, retryAfterMs: 0 })),
}));

jest.mock("@/lib/email/disposable-domains", () => ({
  assertNotDisposable: jest.fn(async () => undefined),
  DisposableEmailError: class DisposableEmailError extends Error {},
}));

jest.mock("@/emails/EmailOtp", () => ({
  EmailOtp: jest.fn(() => null),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

jest.mock("@/lib/auth-rate-limit", () => ({
  consumeAuthRateLimit: jest.fn(async () => ({ ok: true, retryAfterMs: 0 })),
}));

jest.mock("@/lib/trusted-origin", () => ({
  hasTrustedMutationOrigin: jest.fn(async () => true),
}));

const mockedExternalDisabled = areExternalApisDisabled as jest.Mock;
const mockedSend = sendTransactionalEmail as jest.Mock;
const mockedReserve = reserveEmailOtpSend as jest.Mock;
const mockedRateLimit = consumeAuthRateLimit as jest.Mock;
const mockedIssue = issueEmailOtpCode as jest.Mock;

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const setNodeEnv = (value: string) => {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedExternalDisabled.mockReturnValue(false);
  mockedSend.mockResolvedValue({ ok: true, providerId: "e1" });
  mockedReserve.mockResolvedValue({ ok: true, retryAfterMs: 0 });
  mockedRateLimit.mockResolvedValue({ ok: true, retryAfterMs: 0 });
  mockedIssue.mockResolvedValue("123456");
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
  jest.restoreAllMocks();
});

describe("requestCustomerEmailOtp", () => {
  it("sends the code and returns a generic success", async () => {
    const result = await requestCustomerEmailOtp("Budi@Example.com");

    expect(result).toEqual({ success: true });
    expect(mockedIssue).toHaveBeenCalledWith("budi@example.com");
    expect(mockedSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "budi@example.com", purpose: "otp" })
    );
  });

  it("rejects an invalid address before issuing anything", async () => {
    const result = await requestCustomerEmailOtp("not-an-email");

    expect(result).toEqual({ error: "Email tidak valid" });
    expect(mockedIssue).not.toHaveBeenCalled();
  });

  it("fails closed in production when external APIs are disabled", async () => {
    setNodeEnv("production");
    mockedExternalDisabled.mockReturnValue(true);

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("fails closed in production when the provider send fails", async () => {
    setNodeEnv("production");
    mockedSend.mockResolvedValue({ ok: false, error: "boom" });

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("fails closed in production when the provider is misconfigured and throws", async () => {
    setNodeEnv("production");
    mockedSend.mockRejectedValue(new Error("Missing RESEND_FROM_EMAIL"));

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("logs the code in dev instead of failing when sending is unavailable", async () => {
    setNodeEnv("development");
    mockedExternalDisabled.mockReturnValue(true);

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result).toEqual({ success: true });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("123456"));
  });

  it("refuses to send when the sender-wide guard is exhausted", async () => {
    mockedReserve.mockResolvedValue({ ok: false, retryAfterMs: 8000 });

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result.error).toBeTruthy();
    expect(mockedIssue).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("refuses to send when the per-address rate limit is exhausted", async () => {
    mockedRateLimit.mockResolvedValue({ ok: false, retryAfterMs: 60_000 });

    const result = await requestCustomerEmailOtp("budi@example.com");

    expect(result.error).toBe("Terlalu banyak permintaan. Coba lagi nanti.");
    expect(mockedIssue).not.toHaveBeenCalled();
  });
});
