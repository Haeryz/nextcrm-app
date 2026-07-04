import { getWhatsAppClient, getWhatsAppState } from "@/lib/whatsapp/client";
import { requireMektekCustomerToolApiSession } from "@/lib/api-gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireMektekCustomerToolApiSession();
  if (access.response) return access.response;

  getWhatsAppClient();
  const state = getWhatsAppState();
  return Response.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
