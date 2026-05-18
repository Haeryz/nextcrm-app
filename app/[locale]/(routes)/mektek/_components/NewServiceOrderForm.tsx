"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMektekServiceOrder } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CatalogItemPicker from "./CatalogItemPicker";
import DamageItemsInput, { DamageItem } from "./DamageItemsInput";

export default function NewServiceOrderForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingLink, setTrackingLink] = useState("");
  const [loyaltySummary, setLoyaltySummary] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([
    { description: "", estimatedCost: "", quantity: 1 },
  ]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>([]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [estimatedDone, setEstimatedDone] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const complaint = serviceItems
        .filter((item) => item.description.trim())
        .map((item) =>
          [
            item.description.trim(),
            item.quantity && item.quantity > 1 ? `x${item.quantity}` : "",
            item.catalogPartNumber || item.partNumber
              ? `(${item.catalogPartNumber || item.partNumber})`
              : "",
            item.estimatedCost ? `(Est. Rp ${item.estimatedCost})` : "",
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join("\n");

      const result = await createMektekServiceOrder({
        customerName,
        vehicle,
        complaint: complaint || "-",
        phone,
        address,
        estimatedDone,
        serviceItems,
        sparepartItems,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Service order created");
      setTrackingLink(result?.data?.customerTrackingLink || "");
      const tags =
        result?.data?.tags && typeof result.data.tags === "object"
          ? (result.data.tags as Record<string, unknown>)
          : {};
      const loyaltyTier = typeof tags.loyaltyTier === "string" ? tags.loyaltyTier : "";
      const loyaltyDiscountRate =
        typeof tags.loyaltyDiscountRate === "number" ? tags.loyaltyDiscountRate : 0;
      setLoyaltySummary(
        loyaltyTier && loyaltyDiscountRate > 0
          ? `${loyaltyTier} discount applied automatically: ${loyaltyDiscountRate}%`
          : ""
      );
      setCustomerName("");
      setVehicle("");
      setServiceItems([{ description: "", estimatedCost: "", quantity: 1 }]);
      setSparepartItems([]);
      setPhone("");
      setAddress("");
      setEstimatedDone("");
      router.refresh();
    });
  };

  const addCatalogItem = (item: DamageItem) => {
    setSparepartItems((current) => {
      const existingIndex = current.findIndex(
        (row) => row.catalogItemId && row.catalogItemId === item.catalogItemId
      );
      if (existingIndex >= 0) {
        return current.map((row, index) =>
          index === existingIndex
            ? { ...row, quantity: Math.max(1, Number(row.quantity) || 1) + 1 }
            : row
        );
      }

      const emptyManualIndex = current.findIndex(
        (row) => !row.catalogItemId && !row.description.trim() && !row.estimatedCost.trim()
      );
      if (emptyManualIndex >= 0) {
        return current.map((row, index) => (index === emptyManualIndex ? item : row));
      }

      return [...current, item];
    });
  };

  const copyLink = async () => {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Customer tracking link copied");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Service Intake
            </p>
            <h3 className="text-lg font-semibold">Input Service Baru</h3>
          </div>
          <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
            Admin Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          placeholder="Customer name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          disabled={isPending}
          required
        />
        <Input
          placeholder="Vehicle (e.g. Toyota Avanza 2021)"
          value={vehicle}
          onChange={(event) => setVehicle(event.target.value)}
          disabled={isPending}
          required
        />
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={isPending}
          required
        />
        <Input
          placeholder="Estimated done"
          type="date"
          value={estimatedDone}
          onChange={(event) => setEstimatedDone(event.target.value)}
          disabled={isPending}
        />
        </div>

        <div className="grid grid-cols-1 gap-3">
        <Input
          placeholder="Address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={isPending}
        />
        <CatalogItemPicker
          disabled={isPending}
          onAddItem={addCatalogItem}
        />
        <DamageItemsInput
          items={serviceItems}
          onChange={setServiceItems}
          disabled={isPending}
        />
        <DamageItemsInput
          items={sparepartItems}
          onChange={setSparepartItems}
          label="Sparepart Items"
          addLabel="Tambah sparepart"
          emptyMessage='Belum ada sparepart. Tambahkan dari katalog atau klik "Tambah sparepart".'
          descriptionPlaceholder={(index) =>
            `Sparepart #${index + 1} (contoh: filter oli)`
          }
          disabled={isPending}
        />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add Service"}
          </Button>
        </div>
      </form>

      {trackingLink && (
        <div className="rounded-xl border p-4 bg-muted/20">
          <p className="text-sm font-medium mb-2">Customer tracking link</p>
          {loyaltySummary && (
            <p className="mb-2 text-sm text-muted-foreground">{loyaltySummary}</p>
          )}
          <div className="flex flex-col md:flex-row gap-2">
            <Input value={trackingLink} readOnly />
            <Button type="button" onClick={copyLink}>
              Copy Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
