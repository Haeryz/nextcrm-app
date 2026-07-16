import type { NextRequest } from "next/server";
import { POST as logoutWhatsApp } from "@/app/api/whatsapp/logout/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return logoutWhatsApp(request);
}
