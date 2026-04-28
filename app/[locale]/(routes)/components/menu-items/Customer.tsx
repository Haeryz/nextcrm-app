import { ShoppingBag } from "lucide-react";
import { NavItem } from "../nav-main";

const getCustomerMenuItem = (): NavItem => {
  return {
    title: "Customer",
    icon: ShoppingBag,
    items: [
      { title: "Customer Mode", url: "/customer", exact: true },
      { title: "Inquiries", url: "/admin/catalog-inquiries" },
      { title: "Customers", url: "/admin/catalog-customers" },
    ],
  };
};

export default getCustomerMenuItem;
