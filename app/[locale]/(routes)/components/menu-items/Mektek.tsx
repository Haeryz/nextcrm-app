import {
  Activity,
  ClipboardList,
  MessageCircle,
  PackageSearch,
  TicketPercent,
  Truck,
  Users,
  UserCog,
  Wrench,
} from "lucide-react";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import {
  canCreateMektekOrders,
  canManageMektekCustomers,
  canManageMektekLogistics,
  canManageMektekVouchers,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
} from "@/lib/mektek/permissions";
import { NavItem } from "../nav-main";

type MektekMenuUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
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

  items.push({
    title: "Pesanan",
    url: "/mektek",
    exact: true,
    icon: ClipboardList,
  });

  if (canCreateMektekOrders(user)) {
    items.push({
      title: "Item",
      url: "/mektek/items",
      icon: PackageSearch,
    });
  }

  if (canManageMektekLogistics(user)) {
    items.push({
      title: "Logistics",
      url: "/mektek/logistics",
      icon: Truck,
    });
  }

  if (canUseMektekCustomerTools(user)) {
    items.push({
      title: "WhatsApp",
      url: "/mektek/whatsapp",
      icon: MessageCircle,
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
