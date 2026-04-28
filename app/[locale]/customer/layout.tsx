import CustomerShell from "./_components/CustomerShell";
import { getCurrentCatalogCustomer } from "@/actions/catalog/customer";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCurrentCatalogCustomer();

  return <CustomerShell customer={customer}>{children}</CustomerShell>;
}
