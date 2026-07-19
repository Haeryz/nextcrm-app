import { NextResponse } from "next/server";

import {
  createMektekVoucherCodeDictionary,
  deleteMektekVoucherCodeDictionary,
  listMektekVoucherCodeDictionaries,
} from "@/actions/mektek/voucher-code-dictionaries";

function statusFor(error?: string) {
  if (!error) return 400;
  if (error === "Unauthorized") return 401;
  if (error.startsWith("Forbidden")) return 403;
  return 400;
}

export async function GET() {
  const result = await listMektekVoucherCodeDictionaries();
  return NextResponse.json(result, {
    status: "error" in result ? statusFor(result.error) : 200,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = await createMektekVoucherCodeDictionary({
    name: String(body.name ?? ""),
    entries: typeof body.entries === "string" || Array.isArray(body.entries) ? body.entries : "",
  });
  return NextResponse.json(result, {
    status: "error" in result ? statusFor(result.error) : 201,
  });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const result = await deleteMektekVoucherCodeDictionary(id);
  return NextResponse.json(result, {
    status: "error" in result ? statusFor(result.error) : 200,
  });
}
