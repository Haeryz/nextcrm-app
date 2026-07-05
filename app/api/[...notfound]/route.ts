import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catch-all for API paths that match no real handler. Next.js resolves specific
 * and more-deeply-nested routes first, so this only fires for genuinely unknown
 * `/api/*` URLs. Returns a clean JSON 404 (never HTML) since API callers expect
 * JSON, with a pointer to the app for humans who land here by mistake.
 */
function notFound(request: NextRequest) {
  const { pathname } = new URL(request.url);
  return Response.json(
    {
      error: "Not Found",
      message: `No API route matches ${pathname}. Check the URL or method.`,
      status: 404,
    },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
export const HEAD = notFound;
