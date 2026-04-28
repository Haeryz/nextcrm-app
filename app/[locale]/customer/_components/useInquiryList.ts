"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/catalog/types";

const STORAGE_KEY = "nextcrm.catalog.inquiry.v1";

export type InquiryListItem = {
  itemId: string;
  quantity: number;
  machine: string;
  description: string;
  partNumber: string;
  catalogPartNumber: string;
  price: number | null;
  imageUrl: string | null;
};

function snapshotFromCatalogItem(item: CatalogItem, quantity: number): InquiryListItem {
  return {
    itemId: item.id,
    quantity,
    machine: item.machine,
    description: item.description,
    partNumber: item.partNumber,
    catalogPartNumber: item.catalogPartNumber,
    price: item.price,
    imageUrl: item.imageUrl,
  };
}

function readStoredItems(): InquiryListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.itemId && Number(item.quantity) > 0);
  } catch {
    return [];
  }
}

export function useInquiryList() {
  const [items, setItems] = useState<InquiryListItem[]>([]);

  useEffect(() => {
    setItems(readStoredItems());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  );

  function addItem(item: CatalogItem, quantity = 1) {
    setItems((current) => {
      const existing = current.find((row) => row.itemId === item.id);
      if (existing) {
        return current.map((row) =>
          row.itemId === item.id
            ? { ...row, quantity: Math.min(row.quantity + quantity, 999) }
            : row
        );
      }
      return [...current, snapshotFromCatalogItem(item, Math.max(1, quantity))];
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    setItems((current) =>
      current
        .map((item) =>
          item.itemId === itemId
            ? { ...item, quantity: Math.max(1, Math.min(999, Math.floor(quantity))) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.itemId !== itemId));
  }

  function clearItems() {
    setItems([]);
  }

  return {
    items,
    itemCount,
    addItem,
    updateQuantity,
    removeItem,
    clearItems,
  };
}
