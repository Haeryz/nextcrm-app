import "server-only";

import { headers } from "next/headers";

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim().toLowerCase() ?? "";
}

function configuredAppHost(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  try {
    return configured ? new URL(configured).host.toLowerCase() : "";
  } catch {
    return "";
  }
}

export function isTrustedMutationOrigin(requestHeaders: Headers): boolean {
  const fetchSite = requestHeaders.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = requestHeaders.get("origin");
  if (!origin) {
    // Modern browser mutations include Origin. Keep tests and trusted local tooling
    // usable, but fail closed for an origin-less production browser request.
    return process.env.NODE_ENV !== "production";
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
    return false;
  }

  const forwardedHost = firstHeaderValue(
    requestHeaders.get("x-forwarded-host"),
  );
  const requestHost = firstHeaderValue(requestHeaders.get("host"));
  const allowedHosts = new Set(
    [forwardedHost, requestHost, configuredAppHost()].filter(Boolean),
  );

  return allowedHosts.has(originUrl.host.toLowerCase());
}

export async function hasTrustedMutationOrigin(): Promise<boolean> {
  return isTrustedMutationOrigin(await headers());
}
