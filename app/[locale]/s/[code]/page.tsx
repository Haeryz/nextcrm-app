import { notFound } from "next/navigation";
import { getPublicMektekServiceOrderByCode } from "@/actions/mektek/service-orders";
import ServiceStatusPage from "../../service-status/[id]/page";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ShortServiceStatusPage({ params }: Props) {
  const { code } = await params;
  const order = await getPublicMektekServiceOrderByCode(code);

  const tags =
    order?.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : {};
  const token = typeof tags.customerToken === "string" ? tags.customerToken : "";

  if (!order || !token) notFound();

  return ServiceStatusPage({
    params: Promise.resolve({ id: order.id }),
    searchParams: Promise.resolve({ token }),
  });
}
