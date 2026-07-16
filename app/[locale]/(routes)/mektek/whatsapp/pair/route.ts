import type { NextRequest } from "next/server";
import { GET as startWhatsAppPairing } from "@/app/api/whatsapp/pair/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return startWhatsAppPairing(request);
}
