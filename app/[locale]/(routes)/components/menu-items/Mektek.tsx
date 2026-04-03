import { Wrench } from "lucide-react";
import { NavItem } from "../nav-main";

type Props = {
  title: string;
};

const getMektekMenuItem = ({ title }: Props): NavItem => {
  return {
    title,
    icon: Wrench,
    items: [
      { title: "Orders", url: "/mektek", exact: true },
      { title: "WhatsApp", url: "/mektek/whatsapp" },
    ],
  };
};

export default getMektekMenuItem;
