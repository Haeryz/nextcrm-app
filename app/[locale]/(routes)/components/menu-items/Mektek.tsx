import {
  Activity,
  ClipboardList,
  CircleDollarSign,
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
  canManageMektekCatalog,
  canManageMektekCustomers,
  canManageMektekLogistics,
  canManageMektekFinance,
  canManageMektekVouchers,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
  canViewMektekOrders,
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

  if (canViewMektekDashboard(user)) {
    items.push({
      title: "Dashboard",
      url: "/mektek/dashboard",
      icon: Activity,
    });
  }

  if (canViewMektekOrders(user)) {
    items.push({
      title: "Pesanan",
      url: "/mektek",
      exact: true,
      icon: ClipboardList,
    });
  }

  const canUseCatalog = canManageMektekCatalog(user);
  const canUseMonitoring = canManageMektekLogistics(user, "MONITORING_PO");
  const canUseReceiving = canManageMektekLogistics(user, "RECEIVING");
  if (canUseCatalog || canUseMonitoring || canUseReceiving) {
    items.push({
      title: "Logistics",
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
      ],
    });
  }

  if (canManageMektekFinance(user)) {
    items.push({
      title: "Finance",
      icon: CircleDollarSign,
      items: [
        {
          title: "Accounting",
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
          ],
            },
            { title: "Pembayaran Pemasok", url: "/mektek/finance/payables" },
            { title: "Payment Faktur", url: "/mektek/finance/payment-faktur" },
            { title: "Laporan Hutang Pemasok", url: "/mektek/finance/supplier-debt-report" },
      ],
    });
  }

  if (canUseMektekCustomerTools(user)) {
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
  }

  if (canManageMektekCustomers(user)) {
    items.push({
      title: "Pelanggan",
      url: "/mektek/customers",
      icon: Users,
    });
  }

  if (canManageMektekVouchers(user)) {
    items.push({
      title: "Voucher",
      url: "/mektek/vouchers",
      icon: TicketPercent,
    });
  }

  if (user?.isAdmin) {
    items.push({
      title: "Technician",
      url: "/mektek/technicians",
      icon: Wrench,
    });

    items.push({
      title: "Sub-admin",
      url: "/mektek/staff",
      icon: UserCog,
    });
  }

  return items;
};

export default getMektekMenuItems;
