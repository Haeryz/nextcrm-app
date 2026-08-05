// Single source for the canonical production origin. `NEXT_PUBLIC_APP_URL` is the
// documented setting (see .env.example); `NEXTAUTH_URL` is a historical alias
// still present in some deployed envs. Both are build/runtime public vars.
//
// Always returns a string without a trailing slash so callers can safely append
// path segments (`${siteBaseUrl()}/sitemap.xml`). The fallback is the legacy
// Vercel preview host so a misconfigured deploy still produces valid URLs
// instead of `localhost` leaking into search results.
export function siteBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://mektek-bice.vercel.app";

  return url.replace(/\/+$/, "");
}

export function siteBaseUrlAsUrl(): URL {
  try {
    return new URL(siteBaseUrl());
  } catch {
    return new URL("https://mektek-bice.vercel.app");
  }
}
