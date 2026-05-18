import { Activity, ClipboardList, MessageCircle } from "lucide-react";
import { NavItem } from "../nav-main";

const getMektekMenuItems = (): NavItem[] => [
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
    title: "WhatsApp",
    url: "/mektek/whatsapp",
    icon: MessageCircle,
  },
];

export default getMektekMenuItems;
