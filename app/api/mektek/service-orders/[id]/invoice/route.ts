import { getMektekServiceOrderById, getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { buildMektekInvoiceData, renderMektekInvoicePdf } from "@/actions/mektek/invoice-pdf";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const download = url.searchParams.get("download") === "1";

  let order = null;

  if (token) {
    order = await getPublicMektekServiceOrder(params.id, token);
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }
    order = await getMektekServiceOrderById(params.id);
  }

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const invoiceData = buildMektekInvoiceData(order);
  const pdf = await renderMektekInvoicePdf(invoiceData);
  const filename = `invoice-${params.id.slice(0, 8)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
