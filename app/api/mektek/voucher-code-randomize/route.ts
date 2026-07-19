import { NextResponse } from "next/server";

import { randomizeMektekVoucherCode } from "@/actions/mektek/voucher-code-dictionaries";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || (body.mode !== "PURE_RANDOM" && body.mode !== "DICTIONARY")) {
    return NextResponse.json({ error: "Mode must be PURE_RANDOM or DICTIONARY" }, { status: 400 });
  }

  const result = await randomizeMektekVoucherCode(
    body.mode === "DICTIONARY"
      ? { mode: "DICTIONARY", dictionaryId: String(body.dictionaryId ?? "") }
      : { mode: "PURE_RANDOM", length: Number(body.length) || undefined }
  );
  const error = "error" in result ? result.error : undefined;
  const status =
    error
      ? error === "Unauthorized"
        ? 401
        : error.startsWith("Forbidden")
          ? 403
          : 400
      : 200;
  return NextResponse.json(result, { status });
}
