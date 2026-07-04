"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";

import { prismadb } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone";
import { createMektekPaymentIntent } from "@/actions/mektek/payments";
import type { MektekLineItem } from "@/lib/mektek/items";

const MEKTEK_TITLE_PREFIX = "MEKTEK Service -";
const STORE_TIMELINE_MESSAGE =
  "Pesanan sparepart Anda telah dibuat. Selesaikan pembayaran untuk memproses pesanan.";

export type CatalogPurchaseLineInput = {
  catalogItemId: string;
  quantity?: number;
};

type CreateCatalogPurchaseInput = {
  items?: CatalogPurchaseLineInput[];
  customerName?: string;
  phone?: string;
  address?: string;
  locale?: string;
};

const createCustomerCode = () => crypto.randomBytes(12).toString("base64url");

const clampQuantity = (value: unknown) => {
  const n = Math.floor(Number(value) || 1);
  return Math.min(Math.max(n, 1), 99);
};

/**
 * Public, token-less catalog checkout for the customer storefront.
 * Every price is recomputed server-side from CatalogItem — the client never
 * supplies an amount. Unpriced items ("Hubungi admin") are rejected. Creates a
 * payable Mektek service order, then reuses the proven payment-intent flow so
 * the existing Midtrans webhook reconciles it exactly like any other order.
 */
export const createMektekCatalogPurchaseIntent = async (
  input: CreateCatalogPurchaseInput
) => {
  const customerName = String(input?.customerName ?? "").trim();
  const phone = String(input?.phone ?? "").trim();
  const address = String(input?.address ?? "").trim();
  const locale = String(input?.locale ?? "en").trim() || "en";
  const phoneNormalized = normalizePhoneNumber(phone);

  if (!customerName) return { error: "Nama wajib diisi" };
  if (phoneNormalized.replace(/\D/g, "").length < 8) {
    return { error: "Nomor telepon tidak valid" };
  }

  // Collapse duplicate lines and clamp quantities.
  const requested = new Map<string, number>();
  for (const line of Array.isArray(input?.items) ? input!.items! : []) {
    const id = String(line?.catalogItemId ?? "").trim();
    if (!id) continue;
    requested.set(id, (requested.get(id) ?? 0) + clampQuantity(line?.quantity));
  }
  if (requested.size === 0) return { error: "Keranjang kosong" };

  try {
    const catalogItems = await prismadb.catalogItem.findMany({
      where: { id: { in: [...requested.keys()] } },
      select: {
        id: true,
        machine: true,
        description: true,
        partNumber: true,
        catalogPartNumber: true,
        price: true,
      },
    });

    const sparepartItems: MektekLineItem[] = [];
    for (const item of catalogItems) {
      const price = typeof item.price === "number" ? item.price : 0;
      if (price <= 0) continue; // unpriced → not buyable
      const quantity = clampQuantity(requested.get(item.id));
      sparepartItems.push({
        kind: "sparepart",
        source: "catalog",
        catalogItemId: item.id,
        name: item.description,
        machine: item.machine ?? null,
        partNumber: item.partNumber ?? null,
        catalogPartNumber: item.catalogPartNumber ?? null,
        quantity,
        unit: "PCS",
        unitPrice: price,
        total: price * quantity,
      });
    }

    if (sparepartItems.length === 0) {
      return { error: "Item yang dipilih belum memiliki harga. Hubungi admin." };
    }

    const customerToken = crypto.randomBytes(20).toString("hex");
    const customerCode = createCustomerCode();
    const titleSuffix =
      sparepartItems.length === 1
        ? sparepartItems[0].name.slice(0, 40)
        : `${sparepartItems.length} sparepart`;

    const order = await prismadb.$transaction(async (tx) => {
      const catalogCustomer = await tx.catalogCustomer.upsert({
        where: { phoneNormalized },
        update: { phone, customerType: "STANDARD" },
        create: {
          username: customerName,
          phone,
          phoneNormalized,
          customerType: "STANDARD",
        },
        select: { id: true },
      });

      const created = await tx.crm_Accounts_Tasks.create({
        data: {
          v: 0,
          title: `${MEKTEK_TITLE_PREFIX} ${titleSuffix}`,
          content: "Pembelian sparepart via katalog online",
          priority: "medium",
          taskStatus: "ACTIVE",
          tags: {
            module: "mektek",
            serviceType: "Sparepart Purchase",
            orderSource: "customer_storefront",
            customerToken,
            customerCode,
            customerName,
            phone,
            phoneNormalized,
            customerType: "STANDARD",
            address: address || null,
            catalogCustomerId: catalogCustomer.id,
            serviceItems: [],
            sparepartItems,
            discount: 0,
            tax: 0,
            payment: {
              method: "midtrans",
              amountPaid: 0,
              status: "unpaid",
              provider: "midtrans",
              updatedAt: null,
            },
            timeline: [
              {
                id: crypto.randomUUID(),
                description: STORE_TIMELINE_MESSAGE,
                createdAt: new Date().toISOString(),
                completed: true,
              },
            ],
          },
        },
        select: { id: true },
      });

      await tx.catalogServiceLink.upsert({
        where: {
          customerId_serviceOrderId: {
            customerId: catalogCustomer.id,
            serviceOrderId: created.id,
          },
        },
        update: { source: "SELF_SERVICE", token: customerToken },
        create: {
          customerId: catalogCustomer.id,
          serviceOrderId: created.id,
          source: "SELF_SERVICE",
          token: customerToken,
        },
      });

      return created;
    });

    // Reuse the proven, webhook-reconciled payment intent path.
    const intent = await createMektekPaymentIntent({
      serviceOrderId: order.id,
      token: customerToken,
    });

    if (intent?.error || !intent?.data) {
      return { error: intent?.error ?? "Gagal memulai pembayaran" };
    }

    revalidatePath("/[locale]/customer", "page");

    return {
      data: {
        ...intent.data,
        serviceOrderId: order.id,
        trackingCode: customerCode,
        trackingPath: `/${locale}/s/${customerCode}`,
      },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_CATALOG_PURCHASE_INTENT]", error);
    return { error: "Gagal membuat pesanan" };
  }
};
