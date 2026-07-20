"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import {
  notifyMektekOrderCompleted,
  notifyMektekOrderCreated,
  notifyMektekOrderReadyForPayment,
} from "@/actions/mektek/whatsapp-notifications";
import {
  appendMektekLineItems,
  buildMektekStoredItems,
  haveRequiredMektekItemPrices,
  normalizeMektekLineItems,
  type MektekLineItemInput,
} from "@/lib/mektek/items";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekPayments,
  canManageMektekSchedule,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";
import { calculateMektekDiscountAmount } from "@/lib/mektek/loyalty";
import { parseMoney } from "@/lib/mektek/items";
import {
  findMektekVoucherRecordByCode,
  reserveMektekVoucherUse,
} from "@/lib/mektek/voucher-db";
import {
  MEKTEK_TITLE_PREFIX,
  mektekOrderWhere,
  mektekPaymentSelect,
} from "@/lib/mektek/orders";
import { buildMektekServiceCustomerUpsert } from "@/lib/mektek/service-customer";
import { validateMektekTechnicianIds } from "@/lib/mektek/technicians";
import { parseVehicleMileageKm } from "@/lib/mektek/vehicle-mileage";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import {
  boundedText,
  MAX_ADDRESS_LEN,
  MAX_COMPLAINT_LEN,
  MAX_NAME_LEN,
  MAX_VEHICLE_FLEET_NUMBER_LEN,
  MAX_VEHICLE_LEN,
  MAX_VEHICLE_PLATE_NUMBER_LEN,
} from "@/lib/mektek/sanitize";
import {
  calculateMektekVoucherDiscount,
  isMektekVoucherAvailable,
  toMektekVoucher,
} from "@/lib/mektek/vouchers";
import { getCatalogImageSource } from "@/lib/catalog-images";
import { parseEstimatedDoneInput } from "@/lib/mektek/schedule";
import {
  canEditMektekOrderItems,
  canFinalizeMektekOrder,
  canTransitionMektekOrderStatus,
  isMektekPaymentAvailable,
} from "@/lib/mektek/order-lifecycle";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";
import { normalizeMektekVehiclePlateNumber } from "@/lib/mektek/customer-vehicles";

const DEFAULT_TIMELINE_MESSAGE =
  "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.";

/**
 * Constant-time string comparison for access secrets (customer tokens). Hashing
 * both sides to a fixed-length digest lets us compare with `timingSafeEqual`
 * without leaking length and without it throwing on differing input lengths.
 * Low risk at 20-byte entropy, but keeps this consistent with the webhook's
 * `timingSafeEqual` signature check.
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

type MektekTimelineEntry = {
  id: string;
  description: string;
  createdAt: string;
  completed?: boolean;
};

const parseTagsObject = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return {};
  }
  return tags as Record<string, unknown>;
};

const parseWhatsappMeta = (tags: Record<string, unknown>): Record<string, unknown> => {
  const whatsapp = tags.whatsapp;
  if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) return {};
  return whatsapp as Record<string, unknown>;
};

type CreateMektekServiceOrderInput = {
  locale?: string;
  customerName: string;
  vehicle: string;
  vehiclePlateNumber: string;
  vehicleFleetNumber?: string;
  vehicleMileageKm: string | number;
  complaint: string;
  /** @deprecated Use technicianIds. Retained for older callers during migration. */
  technicianId?: string;
  technicianIds?: string[];
  phone?: string;
  address?: string;
  customerType?: "STANDARD" | "B2B";
  estimatedDone?: string;
  manualDiscount?: string | number;
  voucherCode?: string;
  serviceItems?: MektekLineItemInput[];
  sparepartItems?: MektekLineItemInput[];
};

export type MektekCustomerSearchResult = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  customerType: "STANDARD" | "B2B";
  vehicleName: string | null;
  vehiclePlateNumber: string | null;
  vehicleFleetNumber: string | null;
  vehicles: MektekCustomerVehicleSearchResult[];
  address: string | null;
  source: "customer" | "user";
};

export type MektekCustomerVehicleSearchResult = {
  id: string;
  name: string;
  plateNumber: string;
  fleetNumber: string | null;
  isPrimary: boolean;
};

export type MektekTechnicianOption = {
  id: string;
  name: string;
  role: "MECHANIC" | "HELPER" | "OJT";
};

const parseTimeline = (tags: unknown): MektekTimelineEntry[] => {
  const tagsObject = parseTagsObject(tags);
  const timeline = tagsObject.timeline;
  if (!Array.isArray(timeline)) return [];

  return timeline
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const description = typeof row.description === "string" ? row.description.trim() : "";
      const createdAt = typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString();
      const completed = typeof row.completed === "boolean" ? row.completed : undefined;
      const id = typeof row.id === "string" ? row.id : crypto.randomUUID();

      if (!description) return null;
      return {
        id,
        description,
        createdAt,
        ...(completed === undefined ? {} : { completed }),
      };
    })
    .filter((row): row is MektekTimelineEntry => !!row)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// These links are sent to customers over WhatsApp, so the base URL must come
// from trusted server-side config — NEVER from attacker-controllable
// `Host`/`X-Forwarded-Host` request headers (host-header injection → phishing).
// Request headers are used only as a last resort, and only when the host is a
// loopback/local address so a spoofed Host header can't poison the link.
const buildAppUrl = async () => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const hostname = host.split(":")[0];
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local");
  if (host && isLocal) {
    const proto = requestHeaders.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
};

const createCustomerCode = () => crypto.randomBytes(12).toString("base64url");

const TRACKING_LOCALES = new Set(["id", "en", "cz", "de", "uk"]);

const normalizeTrackingLocale = (locale?: string) => {
  const normalized = String(locale ?? "").trim().toLowerCase();
  return TRACKING_LOCALES.has(normalized) ? normalized : "id";
};

const buildCustomerTrackingLink = async (code: string, locale?: string) => {
  const appUrl = await buildAppUrl();
  const safeLocale = normalizeTrackingLocale(locale);
  return `${appUrl}/${safeLocale}/s/${code}`;
};

export const createMektekServiceOrder = async (
  input: CreateMektekServiceOrderInput
) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized: silakan Login" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat membuat Service Order" };
  }

  const customerName = boundedText(input?.customerName, MAX_NAME_LEN);
  const vehicle = boundedText(input?.vehicle, MAX_VEHICLE_LEN);
  const vehiclePlateNumber = boundedText(
    input?.vehiclePlateNumber,
    MAX_VEHICLE_PLATE_NUMBER_LEN,
  ).toUpperCase();
  const vehicleFleetNumber = boundedText(
    input?.vehicleFleetNumber,
    MAX_VEHICLE_FLEET_NUMBER_LEN,
  );
  const vehicleMileage = parseVehicleMileageKm(input?.vehicleMileageKm);
  const complaint = boundedText(input?.complaint, MAX_COMPLAINT_LEN);
  const phone = String(input?.phone ?? "").trim();
  const address = boundedText(input?.address, MAX_ADDRESS_LEN);
  const customerType = input?.customerType === "B2B" ? "B2B" : "STANDARD";
  let technicianIds: string[];
  try {
    technicianIds = validateMektekTechnicianIds(
      input?.technicianIds ?? (input?.technicianId ? [input.technicianId] : []),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Technician tidak valid" };
  }
  const phoneNormalized = normalizePhoneNumber(phone);
  const manualDiscount = parseMoney(input?.manualDiscount);
  const voucherCode = String(input?.voucherCode ?? "").trim();

  if (!customerName || !vehicle || !vehiclePlateNumber || !complaint) {
    return { error: "Nama Customer, kendaraan, nomor plat, dan keluhan wajib diisi" };
  }
  const plateNumberNormalized = normalizeMektekVehiclePlateNumber(
    vehiclePlateNumber,
  );
  if (!plateNumberNormalized) {
    return { error: "Nomor plat kendaraan tidak valid" };
  }
  if (customerType === "B2B" && !vehicleFleetNumber) {
    return { error: "Nomor lambung wajib diisi untuk kendaraan perusahaan" };
  }
  if ("error" in vehicleMileage) return { error: vehicleMileage.error };
  if (!isValidPhoneNumber(phone)) {
    return { error: "Nomor telepon wajib diisi untuk menambahkan Customer ke Customer/Users" };
  }

  let dueDateAt: Date | undefined;
  const estimatedDone = String(input?.estimatedDone ?? "").trim();
  if (estimatedDone) {
    const parsedDate = new Date(estimatedDone);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Estimated Done Date tidak valid" };
    }
    dueDateAt = parsedDate;
  }

  const customerToken = crypto.randomBytes(20).toString("hex");
  const customerCode = createCustomerCode();
  const serviceItems = buildMektekStoredItems(input?.serviceItems, "service");
  const sparepartItems = buildMektekStoredItems(input?.sparepartItems, "sparepart");

  if (serviceItems.length === 0) {
    return {
      error: "Tambahkan minimal satu Service Description beserta Estimated Cost",
    };
  }

  if (!haveRequiredMektekItemPrices(serviceItems)) {
    return {
      error: "Estimated Cost wajib diisi untuk setiap Service Description",
    };
  }

  if (!haveRequiredMektekItemPrices(sparepartItems)) {
    return { error: "Estimated Cost wajib diisi untuk setiap sparepart item" };
  }

  const locale = normalizeTrackingLocale(input?.locale || session.user.userLanguage);

  try {
    const creation = await prismadb.$transaction(async (tx) => {
      const technicianRows = await tx.mektekTechnician.findMany({
        where: { id: { in: technicianIds }, isActive: true },
        select: { id: true, name: true, role: true },
      });
      const technicianById = new Map(technicianRows.map((row) => [row.id, row]));
      const technicians = technicianIds
        .map((id) => technicianById.get(id))
        .filter((row): row is NonNullable<typeof row> => !!row);

      if (technicians.length !== technicianIds.length) {
        throw new Error("INVALID_TECHNICIAN");
      }
      const technician = technicians[0];

      const existingCatalogCustomer = await tx.catalogCustomer.findUnique({
        where: { phoneNormalized },
        select: { id: true },
      });
      const catalogCustomer = await tx.catalogCustomer.upsert({
        ...buildMektekServiceCustomerUpsert({
          customerName,
          phone,
          phoneNormalized,
          customerType,
          vehicleName: vehicle,
          vehiclePlateNumber,
          vehicleFleetNumber,
        }),
        select: {
          id: true,
          customerType: true,
        },
      });
      const existingVehicleCount = await tx.catalogCustomerVehicle.count({
        where: { customerId: catalogCustomer.id },
      });
      const catalogCustomerVehicle = await tx.catalogCustomerVehicle.upsert({
        where: {
          customerId_plateNumberNormalized: {
            customerId: catalogCustomer.id,
            plateNumberNormalized,
          },
        },
        update: {
          name: vehicle,
          plateNumber: vehiclePlateNumber,
          fleetNumber:
            catalogCustomer.customerType === "B2B"
              ? vehicleFleetNumber
              : null,
          lastServiceAt: new Date(),
        },
        create: {
          customerId: catalogCustomer.id,
          name: vehicle,
          plateNumber: vehiclePlateNumber,
          plateNumberNormalized,
          fleetNumber:
            catalogCustomer.customerType === "B2B"
              ? vehicleFleetNumber
              : null,
          isPrimary: existingVehicleCount === 0,
          lastServiceAt: new Date(),
        },
      });
      const completedVisitCount = await tx.catalogServiceLink.count({
        where: {
          customerId: catalogCustomer.id,
          serviceOrder: {
            taskStatus: "COMPLETE",
          },
        },
      });
      const subtotal = normalizeMektekLineItems(
        {
          serviceItems,
          sparepartItems,
        },
        complaint
      ).subtotal;
      const loyalty = calculateMektekDiscountAmount(subtotal, completedVisitCount);
      const voucherRecord = voucherCode
        ? await findMektekVoucherRecordByCode(tx, voucherCode)
        : null;
      const voucherContext = {
        customerId: catalogCustomer.id,
        customerType: catalogCustomer.customerType,
      };
      const voucher = voucherRecord
        ? toMektekVoucher(voucherRecord, voucherContext)
        : null;
      const voucherDiscount = voucher
        ? calculateMektekVoucherDiscount(voucher, subtotal)
        : 0;

      if (voucherCode && !voucherRecord) {
        throw new Error("INVALID_VOUCHER");
      }
      if (voucherRecord && !isMektekVoucherAvailable(voucherRecord, voucherContext)) {
        throw new Error("LOCKED_VOUCHER");
      }
      if (voucher && voucherDiscount <= 0) {
        throw new Error("VOUCHER_MINIMUM_NOT_MET");
      }

      const appliesVoucher = manualDiscount <= 0 && voucherDiscount > 0;
      const discount = manualDiscount > 0
        ? manualDiscount
        : appliesVoucher
          ? voucherDiscount
          : loyalty.discountAmount;

      const serviceOrder = await tx.crm_Accounts_Tasks.create({
        data: {
          v: 0,
          title: `${MEKTEK_TITLE_PREFIX} ${vehicle}`,
          content: complaint,
          priority: "medium",
          taskStatus: "ACTIVE",
          // Technician directory records are not login Users. Keep the durable
          // assignment snapshot in tags; legacy orders may still use `user`.
          user: null,
          createdBy: session.user.id,
          updatedBy: session.user.id,
          dueDateAt,
          tags: {
            module: "mektek",
            serviceType: "Vehicle Service",
            customerToken,
            customerCode,
            vehicle,
            customerName,
            phone,
            phoneNormalized,
            customerType: catalogCustomer.customerType,
            vehiclePlateNumber,
            vehicleFleetNumber:
              catalogCustomer.customerType === "B2B" ? vehicleFleetNumber : null,
            vehicleMileageKm: vehicleMileage.data,
            address: address || null,
            technician: technician
              ? {
                  id: technician.id,
                  name: technician.name,
                  role: technician.role,
                }
              : null,
            technicianAssignments: technicians.map((row) => ({
              id: row.id,
              name: row.name,
              role: row.role,
            })),
            technicians: technicians.map((row) => row.name).join(", "),
            catalogCustomerId: catalogCustomer.id,
            catalogCustomerVehicleId: catalogCustomerVehicle.id,
            completedVisitCount,
            loyaltyTier: loyalty.tier?.label ?? null,
            loyaltyDiscountRate: loyalty.discountRate,
            manualDiscount: manualDiscount || null,
            voucher: voucher && appliesVoucher
              ? {
                  id: voucher.id,
                  code: voucher.code,
                  title: voucher.title,
                  discountAmount: voucherDiscount,
                }
              : null,
            serviceItems,
            sparepartItems,
            discount,
            ppnEnabled: true,
            pphEnabled: catalogCustomer.customerType === "B2B",
            payment: {
              method: "cash",
              amountPaid: 0,
              status: "unpaid",
              updatedAt: null,
            },
            timeline: [
              {
                id: crypto.randomUUID(),
                description: DEFAULT_TIMELINE_MESSAGE,
                createdAt: new Date().toISOString(),
                completed: true,
              },
            ],
          },
        },
      });

      await tx.catalogServiceLink.upsert({
        where: {
          customerId_serviceOrderId: {
            customerId: catalogCustomer.id,
            serviceOrderId: serviceOrder.id,
          },
        },
        update: {
          source: "ADMIN_ASSIGN",
          token: customerToken,
        },
        create: {
          customerId: catalogCustomer.id,
          serviceOrderId: serviceOrder.id,
          source: "ADMIN_ASSIGN",
          token: customerToken,
        },
      });

      if (voucherRecord && appliesVoucher) {
        const reserved = await reserveMektekVoucherUse(tx, voucherRecord);
        if (!reserved) {
          throw new Error("LOCKED_VOUCHER");
        }
      }

      return {
        serviceOrder,
        customerCreated: !existingCatalogCustomer,
      };
    });

    const task = creation.serviceOrder;

    if (!task?.id) {
      return { error: "Service Order tidak berhasil dibuat" };
    }

    const customerTrackingLink = await buildCustomerTrackingLink(customerCode, locale);

    const tags = parseTagsObject(task.tags);
    const whatsappMeta = parseWhatsappMeta(tags);

    let whatsappResult: { ok: boolean; error?: string } = { ok: false, error: "Skipped" };
    try {
      whatsappResult = await notifyMektekOrderCreated({
        order: task,
        trackingLink: customerTrackingLink,
      });
    } catch (error) {
      console.log("[MEKTEK_WHATSAPP_ORDER_CREATED]", error);
    }

    if (whatsappResult.ok) {
      await prismadb.crm_Accounts_Tasks.update({
        where: { id: task.id },
        data: {
          tags: {
            ...tags,
            whatsapp: {
              ...whatsappMeta,
              orderCreatedAt: new Date().toISOString(),
              lastStatus: "ACTIVE",
            },
          },
        },
      });
    }

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/(routes)/mektek/customers", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    return {
      data: {
        ...task,
        customerTrackingLink,
        customerCreated: creation.customerCreated,
      },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_SERVICE_ORDER]", error);
    if (error instanceof Error) {
      if (error.message === "INVALID_VOUCHER") return { error: "Voucher Code tidak valid" };
      if (error.message === "LOCKED_VOUCHER") return { error: "Voucher tidak tersedia untuk Customer ini" };
      if (error.message === "VOUCHER_MINIMUM_NOT_MET") return { error: "Minimum pembelian Voucher belum terpenuhi" };
      if (error.message === "INVALID_TECHNICIAN") return { error: "Technician yang dipilih tidak tersedia" };
    }
    return { error: "Gagal membuat Service Order" };
  }
};

export const getMektekTechnicians = async (): Promise<{
  data?: MektekTechnicianOption[];
  error?: string;
}> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized: silakan Login" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat melihat Technician" };
  }

  try {
    const technicians = await prismadb.mektekTechnician.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    return { data: technicians };
  } catch (error) {
    console.log("[GET_MEKTEK_TECHNICIANS]", error);
    return { error: "Gagal memuat Technician" };
  }
};

export const searchMektekCustomers = async (
  query: string
): Promise<{ data?: MektekCustomerSearchResult[]; error?: string }> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized: silakan Login" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat mencari Customer" };
  }

  const search = String(query ?? "").trim();
  if (search.length < 2) {
    return { data: [] };
  }

  const normalizedSearch = normalizePhoneNumber(search);
  const searchDigits = normalizedSearch.replace(/\D/g, "");
  const customerWhere: Prisma.CatalogCustomerWhereInput[] = [
    { username: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } },
    { vehicleName: { contains: search, mode: "insensitive" } },
    { vehiclePlateNumber: { contains: search, mode: "insensitive" } },
    { vehicleFleetNumber: { contains: search, mode: "insensitive" } },
    {
      vehicles: {
        some: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { plateNumber: { contains: search, mode: "insensitive" } },
            { fleetNumber: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    },
  ];
  const userWhere: Prisma.UsersWhereInput[] = [
    { name: { contains: search, mode: "insensitive" } },
    { username: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } },
  ];

  if (normalizedSearch) {
    customerWhere.push({ phoneNormalized: { contains: normalizedSearch } });
    userWhere.push({ phoneNormalized: { contains: normalizedSearch } });
  }
  if (searchDigits && searchDigits !== normalizedSearch) {
    customerWhere.push({ phoneNormalized: { contains: searchDigits } });
    userWhere.push({ phoneNormalized: { contains: searchDigits } });
  }

  try {
    const [customers, users] = await Promise.all([
      prismadb.catalogCustomer.findMany({
        where: { OR: customerWhere },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          username: true,
          phone: true,
          phoneNormalized: true,
          customerType: true,
          vehicleName: true,
          vehiclePlateNumber: true,
          vehicleFleetNumber: true,
          vehicles: {
            orderBy: [
              { isPrimary: "desc" },
              { lastServiceAt: "desc" },
              { updatedAt: "desc" },
            ],
            select: {
              id: true,
              name: true,
              plateNumber: true,
              fleetNumber: true,
              isPrimary: true,
            },
          },
          serviceLinks: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              serviceOrder: {
                select: {
                  tags: true,
                },
              },
            },
          },
        },
      }),
      prismadb.users.findMany({
        where: { OR: userWhere },
        orderBy: [{ lastLoginAt: "desc" }, { created_on: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          phoneNormalized: true,
        },
      }),
    ]);

    const results: MektekCustomerSearchResult[] = customers.map((customer) => {
      const tags = parseTagsObject(customer.serviceLinks[0]?.serviceOrder?.tags);
      const address = typeof tags.address === "string" ? tags.address : null;
      const vehicles: MektekCustomerVehicleSearchResult[] =
        customer.vehicles.length > 0
          ? customer.vehicles
          : customer.vehiclePlateNumber
            ? [
                {
                  id: `legacy-${customer.id}`,
                  name: customer.vehicleName || "Kendaraan",
                  plateNumber: customer.vehiclePlateNumber,
                  fleetNumber: customer.vehicleFleetNumber,
                  isPrimary: true,
                },
              ]
            : [];
      const preferredVehicle = vehicles[0];

      return {
        id: customer.id,
        name: customer.username,
        phone: customer.phone,
        phoneNormalized: customer.phoneNormalized,
        customerType: customer.customerType,
        vehicleName: preferredVehicle?.name ?? customer.vehicleName,
        vehiclePlateNumber:
          preferredVehicle?.plateNumber ?? customer.vehiclePlateNumber,
        vehicleFleetNumber:
          preferredVehicle?.fleetNumber ?? customer.vehicleFleetNumber,
        vehicles,
        address,
        source: "customer",
      };
    });

    const seenPhones = new Set(results.map((customer) => customer.phoneNormalized));
    for (const user of users) {
      const phoneNormalized = user.phoneNormalized || normalizePhoneNumber(user.phone || "");
      if (!phoneNormalized || seenPhones.has(phoneNormalized)) continue;

      results.push({
        id: user.id,
        name: user.name || user.username || "Customer",
        phone: user.phone || phoneNormalized,
        phoneNormalized,
        customerType: "STANDARD",
        vehicleName: null,
        vehiclePlateNumber: null,
        vehicleFleetNumber: null,
        vehicles: [],
        address: null,
        source: "user",
      });
      seenPhones.add(phoneNormalized);
    }

    return { data: results.slice(0, 8) };
  } catch (error) {
    console.log("[SEARCH_MEKTEK_CUSTOMERS]", error);
    return { error: "Gagal mencari Customer" };
  }
};

export const searchMektekCatalogItems = async (query: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized: silakan Login" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat mencari Catalogue Items" };
  }

  const search = String(query ?? "").trim();
  if (search.length < 2) {
    return { data: [] };
  }

  try {
    const items = await prismadb.catalogItem.findMany({
      where: {
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { machine: { contains: search, mode: "insensitive" } },
          { partNumber: { contains: search, mode: "insensitive" } },
        ],
      },
      orderBy: [{ machine: "asc" }, { description: "asc" }],
      take: 12,
      select: {
        id: true,
        machine: true,
        imagePath: true,
        imageMimeType: true,
        description: true,
        partNumber: true,
        price: true,
      },
    });

    return {
      data: items.map(({ imageMimeType, ...item }) => ({
        ...item,
        imagePath: getCatalogImageSource({
          id: item.id,
          imageMimeType,
          imagePath: item.imagePath,
        }),
      })),
    };
  } catch (error) {
    console.log("[SEARCH_MEKTEK_CATALOG_ITEMS]", error);
    return { error: "Gagal mencari Catalogue Items" };
  }
};

export const getMektekServiceOrders = async (input?: {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}) => {
  // Every "use server" export is an independently invocable endpoint — authorize here,
  // not just in the calling page (which already pre-gates). Returns other customers'
  // orders incl. access tokens, so throw rather than leak. Throwing keeps the return
  // type a plain result object (no error union) so the page's destructure + tsc pass.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canAccessMektekStaffArea(session.user)) {
    throw new Error("Forbidden");
  }

  const pageSize = Math.min(Math.max(Number(input?.pageSize) || 10, 1), 50);
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const createdAt: Prisma.DateTimeNullableFilter<"crm_Accounts_Tasks"> = {};
  const dateFrom = String(input?.dateFrom ?? "").trim();
  const dateTo = String(input?.dateTo ?? "").trim();

  if (dateFrom) {
    const parsedFrom = new Date(`${dateFrom}T00:00:00.000`);
    if (!Number.isNaN(parsedFrom.getTime())) {
      createdAt.gte = parsedFrom;
    }
  }
  if (dateTo) {
    const parsedTo = new Date(`${dateTo}T23:59:59.999`);
    if (!Number.isNaN(parsedTo.getTime())) {
      createdAt.lte = parsedTo;
    }
  }

  const where: Prisma.crm_Accounts_TasksWhereInput = {
    ...mektekOrderWhere(),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  };

  const totalCount = await prismadb.crm_Accounts_Tasks.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where,
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    orders,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
};

export const getMektekServiceOrderById = async (id: string) => {
  // Defense-in-depth: this "use server" export is invocable directly, so authorize
  // here too. Return null (not an error object) so the order|null contract the
  // invoice/receipt routes and the detail page rely on stays intact. Anonymous
  // customer PDF access does NOT go through here — it uses getPublicMektekServiceOrder*.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canAccessMektekStaffArea(session.user)) {
    return null;
  }

  return prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id,
      ...mektekOrderWhere(),
    },
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
        },
      },
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });
};

export const getPublicMektekServiceOrder = async (id: string, token: string) => {
  if (!id || !token) return null;

  const order = await prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id,
      ...mektekOrderWhere(),
    },
    select: {
      id: true,
      content: true,
      dueDateAt: true,
      taskStatus: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });

  if (!order) return null;

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : null;

  const storedToken =
    typeof tags?.customerToken === "string" ? tags.customerToken : "";
  if (!tags || !storedToken || !constantTimeEqual(storedToken, token)) {
    return null;
  }

  return order;
};

export const getPublicMektekServiceOrderByCode = async (code: string) => {
  const safeCode = String(code ?? "").trim();
  if (!safeCode) return null;

  return prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      ...mektekOrderWhere(),
      tags: {
        path: ["customerCode"],
        equals: safeCode,
      },
    },
    select: {
      id: true,
      content: true,
      dueDateAt: true,
      taskStatus: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });
};

export const addMektekTimelineEntry = async (data: {
  serviceOrderId: string;
  description: string;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden: hanya Admin atau Technician MekTek yang dapat memperbarui Timeline" };
  }

  const serviceOrderId = String(data?.serviceOrderId ?? "").trim();
  const description = String(data?.description ?? "").trim();

  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };
  if (!description) return { error: "Timeline Description wajib diisi" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: {
        id: serviceOrderId,
        ...mektekOrderWhere(),
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!serviceOrder) return { error: "Service Order tidak ditemukan" };

    const tags = parseTagsObject(serviceOrder.tags);
    const timeline = parseTimeline(serviceOrder.tags);
    const nextTimeline: MektekTimelineEntry[] = [
      ...timeline,
      {
        id: crypto.randomUUID(),
        description,
        createdAt: new Date().toISOString(),
      },
    ];

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        tags: {
          ...tags,
          timeline: nextTimeline,
        },
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    return { data: nextTimeline };
  } catch (error) {
    console.log("[ADD_MEKTEK_TIMELINE_ENTRY]", error);
    return { error: "Gagal menambahkan Timeline Entry" };
  }
};

export const updateMektekServiceOrderEstimatedDone = async (input: {
  serviceOrderId: string;
  estimatedDone: string | null;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekSchedule(session.user)) {
    return { error: "Forbidden: hanya Admin MekTek yang dapat mengubah Schedule" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };

  const parsed = parseEstimatedDoneInput(input?.estimatedDone);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const updated = await prismadb.crm_Accounts_Tasks.updateMany({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      data: {
        dueDateAt: parsed.date,
        updatedBy: session.user.id,
      },
    });
    if (updated.count === 0) return { error: "Service Order tidak ditemukan" };

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/(routes)/mektek/customers/[id]", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");

    return { data: { estimatedDone: parsed.date?.toISOString() ?? null } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_SERVICE_ORDER_ESTIMATED_DONE]", error);
    return { error: "Gagal memperbarui Estimated Done Time" };
  }
};

export const appendMektekServiceOrderItems = async (input: {
  serviceOrderId: string;
  serviceItems?: MektekLineItemInput[];
  sparepartItems?: MektekLineItemInput[];
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat menambahkan Order Items" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };

  const addedServiceItems = buildMektekStoredItems(input?.serviceItems, "service");
  const addedSparepartItems = buildMektekStoredItems(input?.sparepartItems, "sparepart");
  if (addedServiceItems.length === 0 && addedSparepartItems.length === 0) {
    return { error: "Tambahkan minimal satu item servis atau sparepart" };
  }

  if (!haveRequiredMektekItemPrices(addedServiceItems)) {
    return {
      error: "Estimated Cost wajib diisi untuk setiap Service Description",
    };
  }

  if (!haveRequiredMektekItemPrices(addedSparepartItems)) {
    return { error: "Estimated Cost wajib diisi untuk setiap sparepart item" };
  }

  try {
    const order = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: {
        id: true,
        content: true,
        tags: true,
        taskStatus: true,
      },
    });
    if (!order) return { error: "Service Order tidak ditemukan" };
    if (!canEditMektekOrderItems(order.taskStatus)) {
      return {
        error:
          order.taskStatus === "COMPLETE"
            ? "Order Items dikunci permanen setelah Order ditutup"
            : "Order Items dikunci selama Payment Review. Ubah kembali ke In Progress terlebih dahulu.",
      };
    }

    const tags = parseTagsObject(order.tags);
    const nextItems = appendMektekLineItems(tags, order.content, {
      serviceItems: input?.serviceItems,
      sparepartItems: input?.sparepartItems,
    });
    if (nextItems.items.length > 100) {
      return { error: "Service Order maksimal berisi 100 item" };
    }

    const timeline = parseTimeline(order.tags);
    const addedLabels = [
      addedServiceItems.length
        ? `${addedServiceItems.length} service item${addedServiceItems.length === 1 ? "" : "s"}`
        : "",
      addedSparepartItems.length
        ? `${addedSparepartItems.length} sparepart item${addedSparepartItems.length === 1 ? "" : "s"}`
        : "",
    ].filter(Boolean);
    const nextTimeline = [
      ...timeline,
      {
        id: crypto.randomUUID(),
        description: `Added ${addedLabels.join(" and ")}. Invoice total updated.`,
        createdAt: new Date().toISOString(),
        completed: true,
      },
    ];

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: order.id },
      data: {
        tags: {
          ...tags,
          serviceItems: nextItems.serviceItems,
          sparepartItems: nextItems.sparepartItems,
          timeline: nextTimeline,
        },
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/(routes)/mektek/customers/[id]", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");

    return {
      data: {
        addedServiceCount: addedServiceItems.length,
        addedSparepartCount: addedSparepartItems.length,
        serviceSubtotal: nextItems.serviceSubtotal,
        sparepartSubtotal: nextItems.sparepartSubtotal,
        subtotal: nextItems.subtotal,
      },
    };
  } catch (error) {
    console.log("[APPEND_MEKTEK_SERVICE_ORDER_ITEMS]", error);
    return { error: "Gagal menambahkan Service Order Items" };
  }
};

export const updateMektekServiceOrderStatus = async (input: {
  serviceOrderId: string;
  newStatus: "ACTIVE" | "PENDING" | "AWAITING_PAYMENT" | "COMPLETE";
  markAllTimelineComplete?: boolean;
  locale?: string;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden: hanya Admin atau Technician MekTek yang dapat mengubah Order Status" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  const newStatus = input?.newStatus;
  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };
  if (!["ACTIVE", "PENDING", "AWAITING_PAYMENT", "COMPLETE"].includes(newStatus)) {
    return { error: "Status tidak valid" };
  }
  if (newStatus === "COMPLETE" && !canManageMektekPayments(session.user)) {
    return { error: "Forbidden: hanya Admin yang dapat menutup Order yang sudah lunas" };
  }

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: {
        id: true,
        tags: true,
        content: true,
        createdAt: true,
        taskStatus: true,
        mektekPayments: {
          orderBy: { createdAt: "desc" },
          select: mektekPaymentSelect,
        },
      },
    });
    if (!serviceOrder) return { error: "Service Order tidak ditemukan" };

    if (!canTransitionMektekOrderStatus(serviceOrder.taskStatus, newStatus)) {
      return { error: "Status Done · Closed bersifat final dan tidak dapat dibuka kembali" };
    }

    const tags = parseTagsObject(serviceOrder.tags);
    const whatsappMeta = parseWhatsappMeta(tags);
    const lastStatus = typeof whatsappMeta.lastStatus === "string" ? whatsappMeta.lastStatus : "";
    const summary = buildMektekFinancialSummary(
      tags,
      serviceOrder.content,
      serviceOrder.mektekPayments,
    );
    if (
      newStatus === "COMPLETE" &&
      !canFinalizeMektekOrder({
        taskStatus: serviceOrder.taskStatus,
        tags,
        balanceDue: summary.balanceDue,
      })
    ) {
      if (summary.balanceDue > 0) {
        return {
          error: `Order belum dapat ditutup hingga sisa tagihan Rp ${summary.balanceDue.toLocaleString("id-ID")} dibayar`,
        };
      }
      return {
        error: "Ubah Status servis menjadi Service Done · Awaiting Payment sebelum menutup Order",
      };
    }

    const shouldNotifyReady =
      newStatus === "AWAITING_PAYMENT" && lastStatus !== "AWAITING_PAYMENT";
    const shouldNotifyComplete = newStatus === "COMPLETE" && lastStatus !== "COMPLETE";
    let timeline = parseTimeline(serviceOrder.tags);

    if (
      newStatus === "AWAITING_PAYMENT" &&
      input?.markAllTimelineComplete &&
      timeline.length > 0
    ) {
      timeline = timeline.map((e) => ({ ...e, completed: true }));
    }

    let customerToken = typeof tags.customerToken === "string" ? tags.customerToken : "";
    let customerCode = typeof tags.customerCode === "string" ? tags.customerCode : "";
    if ((shouldNotifyReady || shouldNotifyComplete) && !customerCode) {
      customerToken = customerToken || crypto.randomBytes(20).toString("hex");
      customerCode = createCustomerCode();
    }
    const nextTags = {
      ...tags,
      timeline,
      ...(customerToken ? { customerToken } : {}),
      ...(customerCode ? { customerCode } : {}),
    };

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        taskStatus: newStatus,
        tags: nextTags,
        updatedBy: session.user.id,
      },
    });

    if (shouldNotifyReady || shouldNotifyComplete) {
      const trackingLink = customerCode
        ? await buildCustomerTrackingLink(
            customerCode,
            input?.locale || session.user.userLanguage,
          )
        : "";

      let notifyResult: { ok: boolean; error?: string } = { ok: false, error: "Skipped" };
      try {
        notifyResult = shouldNotifyReady
          ? await notifyMektekOrderReadyForPayment({
              order: { ...serviceOrder, taskStatus: newStatus, tags: nextTags },
              trackingLink,
            })
          : await notifyMektekOrderCompleted({
              order: { ...serviceOrder, taskStatus: newStatus, tags: nextTags },
              trackingLink,
            });
      } catch (error) {
        console.log("[MEKTEK_WHATSAPP_ORDER_STATUS]", error);
      }

      if (notifyResult.ok) {
        const notifiedAt = new Date().toISOString();
        await prismadb.crm_Accounts_Tasks.update({
          where: { id: serviceOrder.id },
          data: {
            tags: {
              ...nextTags,
              whatsapp: {
                ...whatsappMeta,
                lastStatus: newStatus,
                ...(newStatus === "AWAITING_PAYMENT"
                  ? { readyForPaymentNotifiedAt: notifiedAt }
                  : { completedNotifiedAt: notifiedAt }),
              },
            },
          },
        });
      }
    }

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/(routes)/mektek/customers/[id]", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    return { data: { status: newStatus, balanceDue: summary.balanceDue } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_SERVICE_ORDER_STATUS]", error);
    return { error: "Gagal memperbarui Service Order Status" };
  }
};

export const updateMektekPayment = async (input: {
  serviceOrderId: string;
  method: "cash" | "transfer" | "qris";
  discount?: string | number;
  ppnEnabled?: boolean;
  pphEnabled?: boolean;
  amountPaid?: string | number;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekPayments(session.user)) {
    return { error: "Forbidden: hanya Admin yang dapat memperbarui Payment" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };
  if (!["cash", "transfer", "qris"].includes(input.method)) {
    return { error: "Payment Method tidak valid" };
  }

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: {
        id: true,
        tags: true,
        content: true,
        taskStatus: true,
        mektekPayments: {
          orderBy: {
            createdAt: "desc",
          },
          select: mektekPaymentSelect,
        },
      },
    });

    if (!serviceOrder) return { error: "Service Order tidak ditemukan" };

    const tags = parseTagsObject(serviceOrder.tags);
    const currentSummary = buildMektekFinancialSummary(
      tags,
      serviceOrder.content,
      serviceOrder.mektekPayments,
    );
    if (
      !isMektekPaymentAvailable({
        taskStatus: serviceOrder.taskStatus,
        tags,
        balanceDue: currentSummary.balanceDue,
      })
    ) {
      return {
        error: "Payment hanya dapat dicatat setelah Status servis ditandai Done",
      };
    }
    const discount = parseMoney(input.discount);
    const wantsTaxSettingChange =
      typeof input.ppnEnabled === "boolean" || typeof input.pphEnabled === "boolean";
    if (wantsTaxSettingChange && !session.user.isAdmin) {
      return { error: "Forbidden: hanya Admin utama yang dapat mengubah pengaturan pajak" };
    }
    const customerType = tags.customerType === "B2B" ? "B2B" : "STANDARD";
    const ppnEnabled =
      typeof input.ppnEnabled === "boolean"
        ? input.ppnEnabled
        : currentSummary.ppnEnabled;
    const pphEnabled =
      customerType === "B2B" &&
      (typeof input.pphEnabled === "boolean"
        ? input.pphEnabled
        : currentSummary.pphEnabled);
    const nextTags = {
      ...tags,
      discount,
      ppnEnabled,
      pphEnabled,
    };
    const summary = buildMektekFinancialSummary(
      nextTags,
      serviceOrder.content,
      serviceOrder.mektekPayments
    );
    const amountPaid = Math.min(
      Math.max(parseMoney(input.amountPaid), summary.payment.providerAmountPaid),
      summary.grandTotal
    );
    const status =
      summary.grandTotal <= 0
        ? "unpaid"
        : amountPaid >= summary.grandTotal
        ? "paid"
        : amountPaid > 0
        ? "partial"
        : "unpaid";

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        tags: {
          ...nextTags,
          discount,
          payment: {
            method: input.method,
            amountPaid,
            status,
            updatedAt: new Date().toISOString(),
          },
        },
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return {
      data: {
        discount,
        ppnEnabled,
        pphEnabled,
        tax: summary.tax,
        pph: summary.pph,
        amountPaid,
        grandTotal: summary.grandTotal,
        status,
      },
    };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_PAYMENT]", error);
    return { error: "Gagal memperbarui Payment" };
  }
};

export const getMektekCustomerTrackingLink = async (
  serviceOrderId: string,
  locale?: string,
) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canUseMektekCustomerTools(session.user) && !canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden" };
  }

  const id = String(serviceOrderId ?? "").trim();
  if (!id) return { error: "Service Order ID wajib diisi" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: {
        id,
        ...mektekOrderWhere(),
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!serviceOrder) return { error: "Service Order tidak ditemukan" };

    const tags = parseTagsObject(serviceOrder.tags);
    let customerToken = typeof tags.customerToken === "string" ? tags.customerToken : "";
    let customerCode = typeof tags.customerCode === "string" ? tags.customerCode : "";

    if (!customerToken || !customerCode) {
      const nextTags = { ...tags };
      customerToken = crypto.randomBytes(20).toString("hex");
      customerCode = createCustomerCode();
      if (typeof tags.customerToken === "string") {
        customerToken = tags.customerToken;
      } else {
        nextTags.customerToken = customerToken;
      }
      if (typeof tags.customerCode === "string") {
        customerCode = tags.customerCode;
      } else {
        nextTags.customerCode = customerCode;
      }

      await prismadb.crm_Accounts_Tasks.update({
        where: { id: serviceOrder.id },
        data: {
          tags: nextTags as Prisma.InputJsonValue,
        },
      });
    }

    return {
      data: {
        link: await buildCustomerTrackingLink(
          customerCode,
          locale || session.user.userLanguage,
        ),
      },
    };
  } catch (error) {
    console.log("[GET_MEKTEK_CUSTOMER_TRACKING_LINK]", error);
    return { error: "Gagal membuat Customer Tracking Link" };
  }
};

export const sendMektekServiceOrderWhatsAppNotification = async (input: {
  serviceOrderId: string;
  message: string;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canUseMektekCustomerTools(session.user)) {
    return { error: "Forbidden: akses komunikasi Customer diperlukan" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  const message = String(input?.message ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 4_000);
  if (!serviceOrderId) return { error: "Service Order ID wajib diisi" };
  if (!message) return { error: "Pesan WhatsApp wajib diisi" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: { tags: true },
    });
    if (!serviceOrder) return { error: "Service Order tidak ditemukan" };

    const tags = parseTagsObject(serviceOrder.tags);
    const rawPhone = typeof tags.phone === "string" ? tags.phone : "";
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone || !isValidPhoneNumber(phone)) {
      return { error: "Nomor WhatsApp Customer tidak tersedia atau tidak valid" };
    }

    const state = await getWhatsAppState();
    if (state.status !== "ready") {
      return { error: "WhatsApp belum terhubung" };
    }

    const result = await sendWhatsAppMessage({ to: phone, message });
    if (!result.ok) {
      return { error: result.error || "Gagal mengirim pesan WhatsApp" };
    }

    return { data: { sent: true } };
  } catch (error) {
    console.log("[SEND_MEKTEK_WHATSAPP_NOTIFICATION]", error);
    return { error: "Gagal mengirim pesan WhatsApp" };
  }
};
