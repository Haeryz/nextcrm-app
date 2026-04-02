import { Wrench } from "lucide-react";
import { NavItem } from "../nav-main";

type Props = {
  title: string;
};

const getMektekMenuItem = ({ title }: Props): NavItem => {
  return {
    title,
    url: "/mektek",
    icon: Wrench,
  };
};

export default getMektekMenuItem;
