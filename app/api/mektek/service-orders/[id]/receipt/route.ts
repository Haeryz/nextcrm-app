import {
  getMektekServiceOrderById,
  getPublicMektekServiceOrder,
  getPublicMektekServiceOrderByCode,
} from "@/actions/mektek/service-orders";
import { buildMektekInvoiceData, renderMektekReceiptPdf } from "@/actions/mektek/invoice-pdf";
import { requireMektekStaffApiSession } from "@/lib/api-gates";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const download = url.searchParams.get("download") === "1";

  // PDF rendering (renderToBuffer) is CPU-heavy. Token/code entropy makes access
  // brute-force infeasible, but a legitimate link holder can still hammer it — so
  // throttle per IP + order id regardless of which auth branch is taken.
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`pdf:${ip}:${id}`, 15, 10 * 60 * 1000);
  if (!rl.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  let order = null;

  if (code) {
    order = await getPublicMektekServiceOrderByCode(code);
  } else if (token) {
    order = await getPublicMektekServiceOrder(id, token);
  } else {
    const access = await requireMektekStaffApiSession();
    if (access.response) return access.response;
    order = await getMektekServiceOrderById(id);
  }

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const invoiceData = buildMektekInvoiceData(order);
  const pdf = (await renderMektekReceiptPdf(invoiceData)).buffer as ArrayBuffer;
  const filename = `struk-${id.slice(0, 8)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
      // These URLs carry ?token / ?code secrets — never leak them via Referer.
      "Referrer-Policy": "no-referrer",
    },
  });
}
