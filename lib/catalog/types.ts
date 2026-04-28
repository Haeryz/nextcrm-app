export type CatalogItem = {
  id: string;
  machine: string;
  rowNumber: number;
  illustration: string;
  partNumber: string;
  catalogPartNumber: string;
  description: string;
  quantity: string | number | null;
  price: number | null;
  remark: string;
  imageId: string | null;
  imageUrl: string | null;
  searchText: string;
};

export type CatalogData = {
  generatedAt: string;
  source: string;
  machines: string[];
  items: CatalogItem[];
};

export type InquiryItemInput = {
  itemId: string;
  quantity: number;
};

export type InquiryItemSnapshot = {
  itemId: string;
  quantity: number;
  machine: string;
  description: string;
  partNumber: string;
  catalogPartNumber: string;
  price: number | null;
  imageUrl: string | null;
};
