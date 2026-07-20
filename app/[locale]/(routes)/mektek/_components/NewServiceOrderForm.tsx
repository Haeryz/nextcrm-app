"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekServiceOrder,
  searchMektekCustomers,
  type MektekCustomerSearchResult,
  type MektekTechnicianOption,
} from "@/actions/mektek/service-orders";
import { ServiceCreatedBurst } from "@/components/mektek/ServiceCreatedBurst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haveRequiredMektekItemInputPrices } from "@/lib/mektek/items";
import { getMektekTodayDateInput } from "@/lib/mektek/schedule";
import { MEKTEK_TECHNICIAN_ROLE_LABELS } from "@/lib/mektek/technicians";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DamageItemsInput, { DamageItem } from "./DamageItemsInput";

const UNASSIGNED_TECHNICIAN = "UNASSIGNED";

type NewServiceOrderFormProps = {
  locale: string;
  initialEstimatedDone: string;
  technicians: MektekTechnicianOption[];
};

export default function NewServiceOrderForm({
  locale,
  initialEstimatedDone,
  technicians,
}: NewServiceOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingLink, setTrackingLink] = useState("");
  const [loyaltySummary, setLoyaltySummary] = useState("");
  const [successBurstKey, setSuccessBurstKey] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleFleetNumber, setVehicleFleetNumber] = useState("");
  const [technicianIds, setTechnicianIds] = useState<string[]>([
    UNASSIGNED_TECHNICIAN,
    UNASSIGNED_TECHNICIAN,
    UNASSIGNED_TECHNICIAN,
  ]);
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
  const formRef = useRef<HTMLFormElement>(null);
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

  useEffect(() => {
    if (formResetKey === 0) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [formResetKey]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const describedServiceItems = serviceItems.filter((item) =>
      item.description.trim(),
    );
    const describedSparepartItems = sparepartItems.filter((item) =>
      item.description.trim(),
    );

    if (describedServiceItems.length === 0) {
      toast.error("Tambahkan minimal satu deskripsi servis");
      return;
    }

    if (!haveRequiredMektekItemInputPrices(describedServiceItems)) {
      toast.error(
        "Estimasi biaya wajib diisi untuk setiap deskripsi servis",
      );
      return;
    }

    if (!haveRequiredMektekItemInputPrices(describedSparepartItems)) {
      toast.error("Estimasi biaya wajib diisi untuk setiap sparepart");
      return;
    }

    const selectedTechnicianIds = technicianIds.filter(
      (id) => id !== UNASSIGNED_TECHNICIAN,
    );
    if (selectedTechnicianIds.length < 1) {
      toast.error("Pilih minimal 1 technician");
      return;
    }
    if (new Set(selectedTechnicianIds).size !== selectedTechnicianIds.length) {
      toast.error("Setiap technician harus berbeda");
      return;
    }

    startTransition(async () => {
      const complaint = describedServiceItems
        .map((item) =>
          [
            item.description.trim(),
            item.quantity && item.quantity > 1 ? `x${item.quantity}` : "",
            item.partNumber ? `(${item.partNumber})` : "",
            item.estimatedCost ? `(Estimasi Rp ${item.estimatedCost})` : "",
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join("\n");

      const result = await createMektekServiceOrder({
        locale,
        customerName,
        vehicle,
        vehiclePlateNumber,
        vehicleFleetNumber,
        complaint: complaint || "-",
        technicianIds: selectedTechnicianIds,
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

      setSuccessBurstKey((currentKey) => currentKey + 1);
      toast.success(
        result?.data?.customerCreated
          ? "Pesanan servis dibuat. Pelanggan baru disimpan secara otomatis."
          : "Pesanan servis berhasil dibuat",
      );
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
          ? `Voucher ${voucherTitle} digunakan: Rp ${voucherDiscount.toLocaleString("id-ID")}`
          : loyaltyTier && loyaltyDiscountRate > 0
          ? `Diskon ${loyaltyTier} diterapkan otomatis: ${loyaltyDiscountRate}%`
          : ""
      );
      selectedCustomerNameRef.current = "";
      setCustomerName("");
      setVehicle("");
      setVehiclePlateNumber("");
      setVehicleFleetNumber("");
      setTechnicianIds([
        UNASSIGNED_TECHNICIAN,
        UNASSIGNED_TECHNICIAN,
        UNASSIGNED_TECHNICIAN,
      ]);
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
    setVehicle(customer.vehicleName ?? "");
    setVehiclePlateNumber(customer.vehiclePlateNumber ?? "");
    setVehicleFleetNumber(customer.vehicleFleetNumber ?? "");
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
    toast.success("Link tracking pelanggan disalin");
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        key={formResetKey}
        ref={formRef}
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Penerimaan Servis
            </p>
            <h3 className="text-lg font-semibold">Input Servis Baru</h3>
          </div>
          <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
            Khusus Admin
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Input
              placeholder="Nama pelanggan"
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
                      Mencari pelanggan...
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
                              {customer.customerType === "B2B"
                                ? " - Perusahaan"
                                : ""}
                              {customer.vehicleName ? ` - ${customer.vehicleName}` : ""}
                              {customer.vehiclePlateNumber
                                ? ` - ${customer.vehiclePlateNumber}`
                                : ""}
                              {customer.address ? ` - ${customer.address}` : ""}
                        </span>
                      </button>
                    ))}
                  {!isSearchingCustomers &&
                    hasCustomerSearchResult &&
                    customerSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Pelanggan tidak ditemukan. Lanjutkan sebagai pelanggan baru.
                      </div>
                    )}
                </div>
              )}
          </div>
          <Input
            placeholder="Kendaraan (mis. Toyota Avanza 2021)"
            value={vehicle}
            onChange={(event) => setVehicle(event.target.value)}
            disabled={isPending}
            required
          />
          <Input
            placeholder="Nomor plat kendaraan"
            value={vehiclePlateNumber}
            onChange={(event) => setVehiclePlateNumber(event.target.value.toUpperCase())}
            disabled={isPending}
            required
          />
          {[0, 1, 2].map((slot) => (
            <Select
              key={slot}
              value={technicianIds[slot]}
              onValueChange={(value) =>
                setTechnicianIds((current) =>
                  current.map((item, index) => (index === slot ? value : item)),
                )
              }
              disabled={isPending}
            >
              <SelectTrigger aria-label={`Teknisi ${slot + 1}`}>
                <SelectValue
                  placeholder={slot === 0 ? "Pilih teknisi utama" : "Tambah teknisi (opsional)"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNASSIGNED_TECHNICIAN}>
                    {slot === 0 ? "Pilih teknisi utama" : "Tidak ada"}
                  </SelectItem>
                  {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.id}>
                      {technician.name} - {MEKTEK_TECHNICIAN_ROLE_LABELS[technician.role]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ))}
          <Input
            placeholder="Telepon"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isPending}
            required
          />
          <Select
            value={customerType}
            onValueChange={(nextValue) => {
              const nextCustomerType = nextValue === "B2B" ? "B2B" : "STANDARD";
              setCustomerType(nextCustomerType);
              if (nextCustomerType === "STANDARD") setVehicleFleetNumber("");
            }}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Jenis pelanggan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Pelanggan standar</SelectItem>
              <SelectItem value="B2B">Perusahaan</SelectItem>
            </SelectContent>
          </Select>
          {customerType === "B2B" && (
            <Input
              placeholder="Nomor lambung"
              value={vehicleFleetNumber}
              onChange={(event) => setVehicleFleetNumber(event.target.value)}
              disabled={isPending}
              required
            />
          )}
          <Input
            aria-label="ETA"
            placeholder="ETA"
            type="date"
            value={estimatedDone}
            onChange={(event) => setEstimatedDone(event.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Input
            placeholder="Alamat"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={isPending}
          />
          <Input
            placeholder="Kode voucher"
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
            label="Daftar Sparepart"
            addLabel="Tambah sparepart"
            emptyMessage='Belum ada sparepart. Tambahkan dari katalog atau klik "Tambah sparepart".'
            descriptionPlaceholder={(index) =>
              `Sparepart #${index + 1} (contoh: filter oli)`
            }
            catalogSearch
            disabled={isPending}
          />
        </div>

        <div className="relative flex justify-end">
          {successBurstKey > 0 && (
            <ServiceCreatedBurst key={successBurstKey} />
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            )}
            {isPending ? "Menyimpan..." : "Tambah Servis"}
          </Button>
        </div>
      </form>

      {trackingLink && (
        <div className="rounded-xl border p-4 bg-muted/20">
          <p className="text-sm font-medium mb-2">Link tracking pelanggan</p>
          {loyaltySummary && (
            <p className="mb-2 text-sm text-muted-foreground">{loyaltySummary}</p>
          )}
          <div className="flex flex-col gap-2 md:flex-row">
            <Input value={trackingLink} readOnly />
            <Button type="button" onClick={copyLink}>
              Salin Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
