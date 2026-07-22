import type { NextRequest } from "next/server";

import { renderMektekCustomerSummaryPdf } from "@/actions/mektek/customer-summary-pdf";
import { requireMektekCustomerToolApiSession } from "@/lib/api-gates";
import { normalizeMektekLineItems } from "@/lib/mektek/items";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tagsRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMektekCustomerToolApiSession();
  if (access.response) return access.response;
  const { id } = await params;
  const rateLimit = checkRateLimit(
    `customer-summary-pdf:${getClientIp(request.headers)}:${id}`,
    20,
    10 * 60 * 1000,
  );
  if (!rateLimit.ok) {
    return new Response("Terlalu banyak Request", { status: 429 });
  }

  const customer = await prismadb.catalogCustomer.findUnique({
    where: { id },
    select: {
      username: true,
      phone: true,
      customerType: true,
      createdAt: true,
      vehicleName: true,
      vehiclePlateNumber: true,
      vehicleFleetNumber: true,
      user: { select: { name: true, email: true } },
      vehicles: {
        orderBy: [{ isPrimary: "desc" }, { lastServiceAt: "desc" }],
        select: { name: true, plateNumber: true, fleetNumber: true },
      },
      serviceLinks: {
        orderBy: { createdAt: "desc" },
        select: {
          serviceOrder: {
            select: {
              id: true,
              serviceNumber: true,
              title: true,
              content: true,
              createdAt: true,
              taskStatus: true,
              tags: true,
            },
          },
        },
      },
    },
  });
  if (!customer) return new Response("Tidak ditemukan", { status: 404 });

  const vehicles = customer.vehicles.length
    ? customer.vehicles
    : customer.vehiclePlateNumber
      ? [{
          name: customer.vehicleName || "Kendaraan",
          plateNumber: customer.vehiclePlateNumber,
          fleetNumber: customer.vehicleFleetNumber,
        }]
      : [];
  const orders = customer.serviceLinks.map(({ serviceOrder: order }) => {
    const tags = tagsRecord(order.tags);
    const items = normalizeMektekLineItems(tags, order.content);
    return {
      number: order.serviceNumber || order.id.slice(0, 8),
      createdAt: order.createdAt ?? customer.createdAt,
      vehicle:
        typeof tags.vehicle === "string" ? tags.vehicle : order.title,
      mileageKm:
        typeof tags.vehicleMileageKm === "number"
          ? tags.vehicleMileageKm
          : null,
      status: order.taskStatus || "ACTIVE",
      service:
        items.serviceItems.map((item) => item.name).join(", ") ||
        order.content ||
        "-",
    };
  });
  const pdf = await renderMektekCustomerSummaryPdf({
    customer: {
      name: customer.user?.name || customer.username,
      phone: customer.phone,
      email: customer.user?.email,
      type: customer.customerType,
      createdAt: customer.createdAt,
    },
    vehicles,
    orders,
  });

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="customer-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
