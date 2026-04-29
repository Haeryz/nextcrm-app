import {
  getMektekServiceOrderById,
  getPublicMektekServiceOrder,
  getPublicMektekServiceOrderByCode,
} from "@/actions/mektek/service-orders";
import { buildMektekInvoiceData, renderMektekInvoicePdf } from "@/actions/mektek/invoice-pdf";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const download = url.searchParams.get("download") === "1";

  let order = null;

  if (code) {
    order = await getPublicMektekServiceOrderByCode(code);
  } else if (token) {
    order = await getPublicMektekServiceOrder(id, token);
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }
    order = await getMektekServiceOrderById(id);
  }

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const invoiceData = buildMektekInvoiceData(order);
  const pdf = (await renderMektekInvoicePdf(invoiceData)).buffer as ArrayBuffer;
  const filename = `invoice-${id.slice(0, 8)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
