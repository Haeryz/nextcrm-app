import { getWhatsAppClient, getWhatsAppState } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  getWhatsAppClient();
  const state = getWhatsAppState();
  return Response.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
