import { NextRequest, NextResponse } from "next/server";

import { isUnsubscribeChannel, type UnsubscribeChannel } from "@/lib/email/unsubscribe";
import { unsubscribeByTokenInternal } from "@/actions/email/preferences";

// RFC 8058 one-click unsubscribe endpoint. Gmail/Yahoo bulk-sender requirements
// (Feb 2024) mandate a POST handler reachable from the List-Unsubscribe header
// that unsubscribes the recipient in a single step, no UI interaction.
//
// These POSTs come from mail-provider infrastructure, NOT the browser. They
// carry no Origin/Referer and no CSRF token, so they are intentionally NOT run
// through hasTrustedMutationOrigin — the single-use hashed token is the proof
// of intent, and consumption makes replay impossible.

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let token = "";
  let channelRaw = "";

  // Mail providers send either application/x-www-form-urlencoded
  // (List-Unsubscribe=One-Click) or JSON. Accept both.
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      token = String(body?.token ?? body?.List_Unsubscribe ?? "");
      channelRaw = String(body?.channel ?? "");
    } catch {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }
  } else {
    try {
      const form = await req.formData();
      token = String(form.get("token") ?? form.get("List-Unsubscribe") ?? "");
      channelRaw = String(form.get("channel") ?? "");
    } catch {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }
  }

  // Fall back to query string if body was empty (some providers GET the link).
  if (!token) {
    const url = new URL(req.url);
    token = String(url.searchParams.get("token") ?? "");
    if (!channelRaw) {
      channelRaw = String(url.searchParams.get("channel") ?? "");
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Token hilang" }, { status: 400 });
  }
  if (!isUnsubscribeChannel(channelRaw)) {
    return NextResponse.json({ error: "Channel tidak valid" }, { status: 400 });
  }

  const channel: UnsubscribeChannel = channelRaw as UnsubscribeChannel;

  // unsubscribeByTokenInternal consumes the single-use token and updates
  // preferences in one step. A bad/used/expired token returns an error before
  // any preference mutation happens.
  const result = await unsubscribeByTokenInternal(token, channel);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 410 });
  }

  // 200 satisfies Gmail/Yahoo one-click semantics.
  return NextResponse.json({ success: true });
}
