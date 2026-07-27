import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);
const AUTH_DISABLED = process.env.NEXTCRM_DISABLE_AUTH === "true";
const AUTH_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

// Admin-only: require session.user.isAdmin
const ADMIN_ONLY_PATHS = [
  "/api/user/activateAdmin",
  "/api/user/deactivateAdmin",
  "/api/user/activate",
  "/api/user/deactivate",
  "/api/user/inviteuser",
  "/api/admin",
];
const MEKTEK_CUSTOMER_TOOL_PATHS = ["/api/whatsapp"];

// Defense-in-depth: verify the request carries a valid JWT. The route handlers
// re-check capabilities against the live database (JWT.staffCapabilities may be
// stale for sessions issued before the staff-capabilities migration). We only
// gate on authentication here; capability enforcement is the route handler's
// job so stale JWTs never block legitimate sub-admins.
const MEKTEK_CAPABILITY_PATHS: Array<{ prefix: string; capability: string }> = [
  { prefix: "/api/mektek/finance", capability: "MEKTEK_FINANCE" },
  { prefix: "/api/mektek/receiving", capability: "MEKTEK_RECEIVING" },
  { prefix: "/api/mektek/logistics", capability: "MEKTEK_MONITORING_PO" },
  { prefix: "/api/mektek/catalog-items", capability: "MEKTEK_CATALOG" },
  { prefix: "/api/mektek/catalog-inventory", capability: "MEKTEK_CATALOG" },
  { prefix: "/api/mektek/service-orders", capability: "MEKTEK_SERVICE_ORDERS" },
];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (AUTH_DISABLED) {
    if (path.startsWith("/api")) {
      return NextResponse.next();
    }
    return intlMiddleware(req);
  }

  // Inngest webhook — pass through, Inngest handles its own auth via signing key
  if (path.startsWith("/api/inngest")) {
    return NextResponse.next();
  }

  // RFC 8058 one-click unsubscribe — POSTed by mail providers (no session, no
  // Origin). Auth is the single-use hashed unsubscribe token, consumed inside
  // the route handler. The Resend webhook (signature-verified) is also public.
  if (
    path === "/api/unsubscribe" ||
    path.startsWith("/api/unsubscribe/") ||
    path === "/api/resend-webhook" ||
    path.startsWith("/api/resend-webhook/")
  ) {
    return NextResponse.next();
  }

  // Admin-only routes — check JWT token's isAdmin flag
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) {
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!token.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (MEKTEK_CUSTOMER_TOOL_PATHS.some((p) => path.startsWith(p))) {
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!token.isAdmin && !token.staffDivision && token.mektekRole !== "CS") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Mektek API defense-in-depth: verify the request is authenticated. The
  // route handlers re-check capabilities against the live database, so we only
  // gate on authentication here. A stale JWT (staffCapabilities from before
  // the migration) still passes because the route handler does the real check.
  const mektekMatch = MEKTEK_CAPABILITY_PATHS.find((entry) =>
    path.startsWith(entry.prefix),
  );
  if (mektekMatch) {
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Non-API routes — delegate to next-intl
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    // Admin-only API paths
    "/api/user/activateAdmin/:path*",
    "/api/user/deactivateAdmin/:path*",
    "/api/user/activate/:path*",
    "/api/user/deactivate/:path*",
    "/api/user/inviteuser",
    "/api/admin/:path*",
    "/api/whatsapp/:path*",
    // Mektek API defense-in-depth
    "/api/mektek/finance/:path*",
    "/api/mektek/receiving/:path*",
    "/api/mektek/logistics/:path*",
    "/api/mektek/catalog-items/:path*",
    "/api/mektek/catalog-inventory/:path*",
    "/api/mektek/service-orders/:path*",
    // All non-API routes (existing intl matcher)
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
  ],
};
