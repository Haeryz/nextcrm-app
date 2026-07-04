import { Activity, ClipboardList, MessageCircle, PackageSearch, Users } from "lucide-react";
import {
  canCreateMektekOrders,
  canManageMektekCustomers,
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
    title: "Orders",
    url: "/mektek",
    exact: true,
    icon: ClipboardList,
  });

  if (canCreateMektekOrders(user)) {
    items.push({
      title: "Items",
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
      title: "Customers",
      url: "/mektek/customers",
      icon: Users,
    });
  }

  return items;
};

export default getMektekMenuItems;
