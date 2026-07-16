import { getRequestSessionUser } from "@/lib/request-session";
import { logoutWhatsApp } from "@/lib/whatsapp";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unlinking needs a live connection to tell WhatsApp to drop the device, so give it
// room — but far less than pairing, since nobody has to scan anything.
export const maxDuration = 60;

// POST, not GET: this destroys the session, so it must not be triggerable by a
// prefetch, a crawler, or an <img> tag pointed at the URL.
export async function POST(request: NextRequest) {
  const user = await getRequestSessionUser(request);
  if (!user?.id) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await logoutWhatsApp();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
