import { notFound } from "next/navigation";
import CustomerItemDetailClient from "../../_components/CustomerItemDetailClient";
import CustomerSignUpForm from "../../_components/CustomerSignUpForm";
import { getCatalogItem, getRelatedCatalogItems } from "@/lib/catalog/data";
import { getCurrentCatalogCustomer } from "@/actions/catalog/customer";

export default async function CustomerCatalogItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const customer = await getCurrentCatalogCustomer();
  if (!customer) {
    return <CustomerSignUpForm />;
  }

  const { itemId } = await params;
  const item = await getCatalogItem(itemId);
  if (!item) notFound();

  return (
    <CustomerItemDetailClient
      item={item}
      relatedItems={await getRelatedCatalogItems(item)}
    />
  );
}
