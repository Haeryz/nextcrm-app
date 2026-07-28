const LOCALE_SEGMENT_PATTERN = /^\/[a-z]{2}(?=\/|$)/i;

export function normalizeNavigationPathname(pathname: string): string {
  return pathname.replace(LOCALE_SEGMENT_PATTERN, "") || "/";
}

export function isNavigationRouteActive(
  pathname: string,
  url: string,
  exact = false,
): boolean {
  const normalizedPathname = normalizeNavigationPathname(pathname);
  const normalizedUrl = url === "" ? "/" : url;

  if (exact || normalizedUrl === "/") {
    return normalizedPathname === normalizedUrl;
  }

  return (
    normalizedPathname === normalizedUrl ||
    normalizedPathname.startsWith(`${normalizedUrl}/`)
  );
}
