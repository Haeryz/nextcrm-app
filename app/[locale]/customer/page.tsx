import CustomerCatalogClient from "./_components/CustomerCatalogClient";
import CustomerSignUpForm from "./_components/CustomerSignUpForm";
import { getCatalogData } from "@/lib/catalog/data";
import { getCurrentCatalogCustomer } from "@/actions/catalog/customer";

export default async function CustomerPage() {
  const customer = await getCurrentCatalogCustomer();

  if (!customer) {
    return <CustomerSignUpForm />;
  }

  const catalog = await getCatalogData();

  return (
    <CustomerCatalogClient items={catalog.items} machines={catalog.machines} />
  );
}
