import { getWhatsAppState } from "@/lib/whatsapp";
import { requireMektekStaffApiSession } from "@/lib/api-gates";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Staff-only: it reveals whether the business WhatsApp is linked and which number
  // is behind it.
  const access = await requireMektekStaffApiSession(request);
  if (access.response) return access.response;
  const { session } = access;

  // Read-only. This used to call getWhatsAppClient(), so a plain GET started a
  // session as a side effect — which on serverless would mean a connection per
  // instance, all fighting over the same credentials. Starting a session is now an
  // explicit, admin-only action: GET /api/whatsapp/pair.
  const state = await getWhatsAppState();

  // lastError can carry configuration detail (env var names, database errors), so
  // only admins — who are the ones who can act on it — see the full state.
  const isAdmin = !!session.user.isAdmin;
  const payload = isAdmin
    ? state
    : { status: state.status, sessionPhone: state.sessionPhone };

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
