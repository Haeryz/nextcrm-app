"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { prismadb } from "@/lib/prisma";
import { isValidPhoneNumber, normalizePhoneNumber, phoneDigits } from "@/lib/phone";
import { createMektekPaymentIntent } from "@/actions/mektek/payments";
import { reserveMektekServiceNumber } from "@/lib/mektek/service-number";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCustomerSessionUser } from "@/lib/customer-auth";
import { boundedText, MAX_ADDRESS_LEN, MAX_NAME_LEN } from "@/lib/mektek/sanitize";
import { MEKTEK_TITLE_PREFIX } from "@/lib/mektek/orders";
import type { MektekLineItem } from "@/lib/mektek/items";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import { createMektekCustomerNumber } from "@/lib/mektek/customer-number";

const STORE_TIMELINE_MESSAGE =
  "Pesanan sparepart Anda telah dibuat. Selesaikan pembayaran untuk memproses pesanan.";

// This endpoint is public and token-less: each call writes several rows and mints
// a Midtrans transaction. Throttle per IP and per phone to blunt scripted flooding.
const PURCHASE_LIMIT = 5;
const PURCHASE_WINDOW_MS = 10 * 60 * 1000;

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
  // Checkout requires an authenticated customer account. This is the authoritative
  // gate; the storefront UI also blocks unauthenticated checkout for better UX.
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const sessionUser = await getCustomerSessionUser();
  if (!sessionUser?.id) {
    return {
      error: "Silakan Login untuk melanjutkan Checkout.",
      code: "AUTH_REQUIRED" as const,
    };
  }

  const customerName = boundedText(input?.customerName, MAX_NAME_LEN);
  // Prefer the authenticated account's own phone so a logged-in customer can only
  // check out as themselves; fall back to the form value if the account has none.
  const phone = (sessionUser.phone || String(input?.phone ?? "")).trim();
  const address = boundedText(input?.address, MAX_ADDRESS_LEN);
  const locale = String(input?.locale ?? "id").trim() || "id";
  const phoneNormalized =
    sessionUser.phoneNormalized || normalizePhoneNumber(phone);

  // Only tie the customer record to the account when the account owns this phone
  // (CatalogCustomer.userId is unique, so linking a staff/other-phone account here
  // would collide). Phone-based customer accounts always satisfy this.
  const linkUserId = sessionUser.phoneNormalized ? sessionUser.id : undefined;

  if (!customerName) return { error: "Nama wajib diisi" };
  // Accept either a canonically-valid phone or a pre-normalized account phone
  // (existing accounts may store numbers that predate canonical validation).
  if (!isValidPhoneNumber(phone) && phoneDigits(phoneNormalized).length < 8) {
    return { error: "Nomor telepon tidak valid" };
  }

  // Throttle scripted abuse: keyed by client IP and by phone independently.
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const ipLimit = checkRateLimit(`catalog-purchase:ip:${ip}`, PURCHASE_LIMIT, PURCHASE_WINDOW_MS);
  const phoneLimit = checkRateLimit(
    `catalog-purchase:phone:${phoneNormalized}`,
    PURCHASE_LIMIT,
    PURCHASE_WINDOW_MS
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    return { error: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit." };
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
        stockWarehouse: null,
        quantity,
        unit: "PCS",
        unitPrice: price,
        total: price * quantity,
      });
    }

    if (sparepartItems.length === 0) {
      return { error: "Item yang dipilih belum memiliki harga. Hubungi Admin." };
    }

    const customerToken = crypto.randomBytes(20).toString("hex");
    const customerCode = createCustomerCode();
    const orderCreatedAt = new Date();
    const titleSuffix =
      sparepartItems.length === 1
        ? sparepartItems[0].name.slice(0, 40)
        : `${sparepartItems.length} sparepart`;

    const order = await prismadb.$transaction(async (tx) => {
      const catalogCustomer = await tx.catalogCustomer.upsert({
        where: { phoneNormalized },
        update: { phone, customerType: "STANDARD", userId: linkUserId },
        create: {
          customerNumber: createMektekCustomerNumber(),
          username: customerName,
          phone,
          phoneNormalized,
          customerType: "STANDARD",
          userId: linkUserId,
        },
        select: { id: true, customerNumber: true },
      });

      const serviceNumber = await reserveMektekServiceNumber(
        {
          mektekServiceMonthlySequence: {
            upsert: (args) => tx.mektekServiceMonthlySequence.upsert(args),
          },
        },
        orderCreatedAt,
      );

      const created = await tx.crm_Accounts_Tasks.create({
        data: {
          serviceNumber,
          v: 0,
          title: `${MEKTEK_TITLE_PREFIX} ${titleSuffix}`,
          content: "Pembelian sparepart via katalog online",
          priority: "medium",
          taskStatus: "ACTIVE",
          createdAt: orderCreatedAt,
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
            catalogCustomerNumber: catalogCustomer.customerNumber,
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
                createdAt: orderCreatedAt.toISOString(),
              },
            ],
          },
        },
        select: { id: true, serviceNumber: true },
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
