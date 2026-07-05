import { getWhatsAppClient, getWhatsAppState } from "@/lib/whatsapp/client";
import { requireMektekStaffApiSession } from "@/lib/api-gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // This endpoint triggers client init and exposes the pairing QR, which links a
  // device to the business WhatsApp. It must never be reachable anonymously.
  const access = await requireMektekStaffApiSession();
  if (access.response) return access.response;
  const { session } = access;

  getWhatsAppClient();
  const state = getWhatsAppState();

  // Only admins may see/scan the pairing QR. Strip it (and error detail) for
  // non-admin staff so they can still see connection status without being able
  // to hijack the session.
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
