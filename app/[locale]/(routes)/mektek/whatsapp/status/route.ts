import type { NextRequest } from "next/server";
import { GET as getWhatsAppStatus } from "@/app/api/whatsapp/status/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep session-sensitive requests under the localized admin path. The production
// auth cookie is scoped there, so a root /api request cannot authenticate even
// though the protected page itself can.
export async function GET(request: NextRequest) {
  return getWhatsAppStatus(request);
}
