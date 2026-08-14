import {
  Activity,
  ClipboardList,
  CircleDollarSign,
  Calculator,
  Mail,
  MessageCircle,
  TicketPercent,
  Truck,
  Users,
  UserCog,
  Wrench,
} from "lucide-react";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffCapability } from "@/lib/auth/staff-capabilities";
import {
  canManageMektekAccounting,
  canManageMektekCatalog,
  canManageMektekFinance,
  canManageMektekLogistics,
  canManageMektekLogisticsPics,
  canViewMektekOrders,
  hasMektekCapability,
} from "@/lib/mektek/permissions";
import { NavItem } from "../nav-main";

type MektekMenuUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  logisticsStaffArea?: LogisticsStaffArea | null;
  staffCapabilities?: StaffCapability[] | null;
  userStatus?: string | null;
};

const getMektekMenuItems = (user?: MektekMenuUser | null): NavItem[] => {
  const items: NavItem[] = [];

  if (hasMektekCapability(user, "MEKTEK_CUSTOMER_SERVICE")) {
    items.push({
      title: "Dasbor",
      url: "/mektek/dashboard",
      icon: Activity,
    });
  }

  if (canViewMektekOrders(user)) {
    items.push({
      title: "Pesanan",
      icon: ClipboardList,
      items: [
        { title: "Buat Pesanan", url: "/mektek", exact: true },
        { title: "Riwayat", url: "/mektek/history" },
      ],
    });
  }

  const canUseCatalog = canManageMektekCatalog(user);
  const canUseMonitoring = canManageMektekLogistics(user, "MONITORING_PO");
  const canUseReceiving = canManageMektekLogistics(user, "RECEIVING");
  const canUseLogisticsPics = canManageMektekLogisticsPics(user);
  if (canUseCatalog || canUseMonitoring || canUseReceiving) {
    items.push({
      title: "Logistik",
      icon: Truck,
      items: [
        ...(canUseCatalog
          ? [{ title: "Catalog / Item", url: "/mektek/items" }]
          : []),
        ...(canUseMonitoring
          ? [{ title: "Monitoring PO", url: "/mektek/logistics" }]
          : []),
        ...(canUseReceiving
          ? [{ title: "Receiving", url: "/mektek/receiving" }]
          : []),
        ...(canUseLogisticsPics
          ? [{ title: "Kelola PIC", url: "/mektek/receiving/pics" }]
          : []),
      ],
    });
  }

  if (canManageMektekAccounting(user)) {
    items.push({
      title: "Akuntansi",
      icon: Calculator,
      items: [
        { title: "Ringkasan", url: "/mektek/finance", exact: true },
        { title: "Rekap Invoice", url: "/mektek/finance/invoices" },
        { title: "Rekap Surat Jalan", url: "/mektek/finance/delivery-notes" },
        { title: "Rekapitulasi Invoice Jasa & Part", url: "/mektek/finance/receivables" },
        { title: "Pendapatan Spare Part", url: "/mektek/finance/spare-parts" },
        { title: "Pendapatan Jasa", url: "/mektek/finance/services" },
        { title: "Rekap Jasa & Part", url: "/mektek/finance/revenue" },
        { title: "Kontrak", url: "/mektek/finance/contracts" },
        { title: "Audit Sistem", url: "/mektek/finance/audit" },
        { title: "Payment Faktur", url: "/mektek/finance/payment-faktur" },
      ],
    });
  }

  if (canManageMektekFinance(user)) {
    items.push({
      title: "Keuangan",
      icon: CircleDollarSign,
      items: [
        { title: "Pembayaran Pemasok", url: "/mektek/finance/payables" },
        { title: "Laporan Hutang Pemasok", url: "/mektek/finance/supplier-debt-report" },
      ],
    });
  }

  if (hasMektekCapability(user, "MEKTEK_CUSTOMER_SERVICE")) {
    items.push({
      title: "WhatsApp",
      url: "/mektek/whatsapp",
      icon: MessageCircle,
    });

    items.push({
      title: "Email",
      url: "/mektek/email",
      icon: Mail,
    });

    items.push({
      title: "Pelanggan",
      url: "/mektek/customers",
      icon: Users,
    });

    items.push({
      title: "Voucher",
      url: "/mektek/vouchers",
      icon: TicketPercent,
    });
  }

  if (hasMektekCapability(user, "MEKTEK_CUSTOMER_SERVICE")) {
    items.push({
      title: "Teknisi",
      url: "/mektek/technicians",
      icon: Wrench,
    });
  }

  if (user?.isAdmin) {
    items.push({
      title: "Admin divisi",
      url: "/mektek/staff",
      icon: UserCog,
    });
  }

  return items;
};

export default getMektekMenuItems;
