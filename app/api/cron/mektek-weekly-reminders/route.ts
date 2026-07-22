import type { NextRequest } from "next/server";

import { sendMektekWeeklyServiceReminders } from "@/actions/mektek/weekly-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendMektekWeeklyServiceReminders();
  return Response.json(result, { status: "error" in result ? 503 : 200 });
}
