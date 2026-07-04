import { notFound } from "next/navigation";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";
import LiveServiceStatus from "./_components/LiveServiceStatus";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ServiceStatusPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  const order = await getPublicMektekServiceOrder(id, token);
  if (!order) notFound();

  const tokenQuery = `token=${encodeURIComponent(token)}`;
  const invoiceHref = `/api/mektek/service-orders/${order.id}/invoice?${tokenQuery}`;
  const receiptHref = `/api/mektek/service-orders/${order.id}/receipt?${tokenQuery}`;

  return (
    <LiveServiceStatus
      initialSnapshot={buildMektekPublicSnapshot(order)}
      streamHref={`/api/mektek/service-orders/${order.id}/stream?${tokenQuery}`}
      invoiceHref={invoiceHref}
      receiptHref={receiptHref}
      invoiceDownloadHref={`${invoiceHref}&download=1`}
      receiptDownloadHref={`${receiptHref}&download=1`}
      payToken={token}
    />
  );
}
