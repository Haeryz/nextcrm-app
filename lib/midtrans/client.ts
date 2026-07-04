import crypto from "crypto";
import { areExternalApisDisabled } from "@/lib/external-apis";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function isMidtransProduction(): boolean {
  const value = process.env.MIDTRANS_IS_PRODUCTION;
  return !!value && TRUE_VALUES.has(value.trim().toLowerCase());
}

/** Snap API base — used to create Snap transactions and load snap.js. */
export function getSnapBaseUrl(): string {
  return isMidtransProduction()
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

/** Core API base — used to query authoritative transaction status. */
export function getCoreApiBaseUrl(): string {
  return isMidtransProduction()
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
}

/** URL of the snap.js browser script matching the current environment. */
export function getSnapScriptUrl(): string {
  return `${getSnapBaseUrl()}/snap/snap.js`;
}

export function getServerKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured.");
  }
  return key;
}

/**
 * The publishable client key for snap.js. Prefers the NEXT_PUBLIC_ variant
 * (the one the browser can read) and falls back to the server-side name.
 */
export function getClientKey(): string {
  const key =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || process.env.MIDTRANS_CLIENT_KEY;
  if (!key) {
    throw new Error("MIDTRANS_CLIENT_KEY is not configured.");
  }
  return key;
}

/** HTTP Basic auth header: base64(serverKey + ":"), password empty. */
export function getAuthHeader(): string {
  const token = Buffer.from(`${getServerKey()}:`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Verify a Midtrans HTTP notification signature.
 * Formula: sha512(order_id + status_code + gross_amount + serverKey).
 * Compared with a constant-time equality check.
 */
export function verifyNotificationSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const { orderId, statusCode, grossAmount, signatureKey } = params;
  if (!signatureKey) return false;

  const expected = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${getServerKey()}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureKey, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export type MidtransStatusVerdict = "paid" | "pending" | "failed";

/**
 * Interpret a Midtrans transaction/notification body into a coarse verdict.
 * Success requires: status_code 200, transaction_status settlement|capture,
 * and fraud_status accept (or absent).
 */
export function interpretTransactionStatus(body: {
  status_code?: string | number;
  transaction_status?: string;
  fraud_status?: string;
}): MidtransStatusVerdict {
  const statusCode = String(body?.status_code ?? "");
  const transactionStatus = String(body?.transaction_status ?? "");
  const fraudStatus = body?.fraud_status ? String(body.fraud_status) : "";

  const fraudOk = !fraudStatus || fraudStatus === "accept";

  if (
    statusCode === "200" &&
    (transactionStatus === "settlement" || transactionStatus === "capture") &&
    fraudOk
  ) {
    return "paid";
  }

  if (transactionStatus === "pending") {
    return "pending";
  }

  // deny, cancel, expire, failure, or challenged fraud
  return "failed";
}

export { areExternalApisDisabled };
