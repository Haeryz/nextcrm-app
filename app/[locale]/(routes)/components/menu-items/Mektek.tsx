import {
  Activity,
  ClipboardList,
  MessageCircle,
  PackageSearch,
  TicketPercent,
  Users,
} from "lucide-react";
import {
  canCreateMektekOrders,
  canManageMektekCustomers,
  canManageMektekVouchers,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
} from "@/lib/mektek/permissions";
import { NavItem } from "../nav-main";

type MektekMenuUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
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

  return items;
};

export default getMektekMenuItems;
