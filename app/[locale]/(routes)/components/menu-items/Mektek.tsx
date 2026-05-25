import { Activity, ClipboardList, MessageCircle, PackageSearch, Users } from "lucide-react";
import { canManageMektekCustomers } from "@/lib/mektek/permissions";
import { NavItem } from "../nav-main";

type MektekMenuUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
};

const getMektekMenuItems = (user?: MektekMenuUser | null): NavItem[] => {
  const items: NavItem[] = [
    {
      title: "Dashboard",
      url: "/mektek/dashboard",
      icon: Activity,
    },
    {
      title: "Orders",
      url: "/mektek",
      exact: true,
      icon: ClipboardList,
    },
    {
      title: "Items",
      url: "/mektek/items",
      icon: PackageSearch,
    },
    {
      title: "WhatsApp",
      url: "/mektek/whatsapp",
      icon: MessageCircle,
    },
  ];

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
