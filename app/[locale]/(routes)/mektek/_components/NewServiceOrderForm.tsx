"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createMektekServiceOrder,
  searchMektekCustomers,
  type MektekCustomerSearchResult,
  type MektekTechnicianOption,
} from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haveRequiredMektekItemInputPrices } from "@/lib/mektek/items";
import { getMektekTodayDateInput } from "@/lib/mektek/schedule";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CatalogItemPicker from "./CatalogItemPicker";
import DamageItemsInput, { DamageItem } from "./DamageItemsInput";

const UNASSIGNED_TECHNICIAN = "UNASSIGNED";

type NewServiceOrderFormProps = {
  initialEstimatedDone: string;
  technicians: MektekTechnicianOption[];
};

export default function NewServiceOrderForm({
  initialEstimatedDone,
  technicians,
}: NewServiceOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingLink, setTrackingLink] = useState("");
  const [loyaltySummary, setLoyaltySummary] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [technicianId, setTechnicianId] = useState(UNASSIGNED_TECHNICIAN);
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([
    { description: "", estimatedCost: "", quantity: 1 },
  ]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>([]);
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"STANDARD" | "B2B">("STANDARD");
  const [address, setAddress] = useState("");
  const [estimatedDone, setEstimatedDone] = useState(initialEstimatedDone);
  const [voucherCode, setVoucherCode] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);
  const [customerSuggestions, setCustomerSuggestions] = useState<
    MektekCustomerSearchResult[]
  >([]);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [hasCustomerSearchResult, setHasCustomerSearchResult] = useState(false);
  const [isSearchingCustomers, startCustomerSearch] = useTransition();
  const selectedCustomerNameRef = useRef("");

  useEffect(() => {
    const query = customerName.trim();
    if (query.length < 2 || query === selectedCustomerNameRef.current) {
      setCustomerSuggestions([]);
      setHasCustomerSearchResult(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      startCustomerSearch(async () => {
        const result = await searchMektekCustomers(query);
        if (cancelled) return;
        if (result?.error) {
          setCustomerSuggestions([]);
          setHasCustomerSearchResult(true);
          return;
        }
        setCustomerSuggestions(result.data ?? []);
        setCustomerSuggestionsOpen(true);
        setHasCustomerSearchResult(true);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [customerName]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const describedServiceItems = serviceItems.filter((item) =>
      item.description.trim(),
    );
    const describedSparepartItems = sparepartItems.filter((item) =>
      item.description.trim(),
    );

    if (describedServiceItems.length === 0) {
      toast.error("Add at least one service description");
      return;
    }

    if (!haveRequiredMektekItemInputPrices(describedServiceItems)) {
      toast.error(
        "Estimated cost is required for every service description",
      );
      return;
    }

    if (!haveRequiredMektekItemInputPrices(describedSparepartItems)) {
      toast.error("Estimated cost is required for every sparepart item");
      return;
    }

    startTransition(async () => {
      const complaint = describedServiceItems
        .map((item) =>
          [
            item.description.trim(),
            item.quantity && item.quantity > 1 ? `x${item.quantity}` : "",
            item.partNumber ? `(${item.partNumber})` : "",
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
        technicianId:
          technicianId === UNASSIGNED_TECHNICIAN ? undefined : technicianId,
        phone,
        customerType,
        address,
        estimatedDone,
        voucherCode,
        serviceItems: describedServiceItems,
        sparepartItems: describedSparepartItems,
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
      const voucher =
        tags.voucher && typeof tags.voucher === "object" && !Array.isArray(tags.voucher)
          ? (tags.voucher as Record<string, unknown>)
          : null;
      const voucherTitle = typeof voucher?.title === "string" ? voucher.title : "";
      const voucherDiscount =
        typeof voucher?.discountAmount === "number" ? voucher.discountAmount : 0;
      setLoyaltySummary(
        voucherTitle && voucherDiscount > 0
          ? `${voucherTitle} voucher applied: Rp ${voucherDiscount.toLocaleString("id-ID")}`
          : loyaltyTier && loyaltyDiscountRate > 0
          ? `${loyaltyTier} discount applied automatically: ${loyaltyDiscountRate}%`
          : ""
      );
      selectedCustomerNameRef.current = "";
      setCustomerName("");
      setVehicle("");
      setTechnicianId(UNASSIGNED_TECHNICIAN);
      setServiceItems([{ description: "", estimatedCost: "", quantity: 1 }]);
      setSparepartItems([]);
      setPhone("");
      setCustomerType("STANDARD");
      setAddress("");
      setEstimatedDone(getMektekTodayDateInput());
      setVoucherCode("");
      setCustomerSuggestions([]);
      setCustomerSuggestionsOpen(false);
      setHasCustomerSearchResult(false);
      setFormResetKey((key) => key + 1);
      router.refresh();
    });
  };

  const selectCustomer = (customer: MektekCustomerSearchResult) => {
    selectedCustomerNameRef.current = customer.name;
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setCustomerType(customer.customerType);
    if (customer.address && !address.trim()) {
      setAddress(customer.address);
    }
    setCustomerSuggestions([]);
    setCustomerSuggestionsOpen(false);
    setHasCustomerSearchResult(false);
  };

  const copyLink = async () => {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Customer tracking link copied");
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6">
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Input
              placeholder="Customer name"
              value={customerName}
              onFocus={() => {
                if (customerSuggestions.length > 0) setCustomerSuggestionsOpen(true);
              }}
              onBlur={() => setCustomerSuggestionsOpen(false)}
              onChange={(event) => {
                selectedCustomerNameRef.current = "";
                setCustomerName(event.target.value);
                setCustomerSuggestionsOpen(true);
              }}
              disabled={isPending}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={customerSuggestionsOpen}
              aria-controls="mektek-customer-suggestions"
              required
            />
            {customerSuggestionsOpen &&
              (customerSuggestions.length > 0 ||
                isSearchingCustomers ||
                hasCustomerSearchResult) && (
                <div
                  id="mektek-customer-suggestions"
                  className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
                >
                  {isSearchingCustomers && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Searching customers...
                    </div>
                  )}
                  {!isSearchingCustomers &&
                    customerSuggestions.map((customer) => (
                      <button
                        key={`${customer.source}-${customer.id}`}
                        type="button"
                        className="flex w-full flex-col gap-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCustomer(customer)}
                      >
                        <span className="text-sm font-medium">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.phone}
                          {customer.customerType === "B2B" ? " - B2B" : ""}
                          {customer.address ? ` - ${customer.address}` : ""}
                        </span>
                      </button>
                    ))}
                  {!isSearchingCustomers &&
                    hasCustomerSearchResult &&
                    customerSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No customer found. Continue as new customer.
                      </div>
                    )}
                </div>
              )}
          </div>
          <Input
            placeholder="Vehicle (e.g. Toyota Avanza 2021)"
            value={vehicle}
            onChange={(event) => setVehicle(event.target.value)}
            disabled={isPending}
            required
          />
          <Select
            value={technicianId}
            onValueChange={setTechnicianId}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Technician">
              <SelectValue placeholder="Assign technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={UNASSIGNED_TECHNICIAN}>Unassigned technician</SelectItem>
                {technicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {technician.name || technician.email}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isPending}
            required
          />
          <Select
            value={customerType}
            onValueChange={(nextValue) => setCustomerType(nextValue === "B2B" ? "B2B" : "STANDARD")}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Customer type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Standard customer</SelectItem>
              <SelectItem value="B2B">B2B customer</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="Estimated done date"
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
          <Input
            placeholder="Voucher code"
            value={voucherCode}
            onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
            disabled={isPending}
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
            catalogSearch
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
          <div className="flex flex-col gap-2 md:flex-row">
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
