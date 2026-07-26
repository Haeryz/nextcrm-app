"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CarFront,
  ClipboardList,
  Loader2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createMektekServiceOrder,
  searchMektekCustomers,
  type MektekCustomerSearchResult,
  type MektekTechnicianOption,
} from "@/actions/mektek/service-orders";
import { ServiceCreatedBurst } from "@/components/mektek/ServiceCreatedBurst";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  formatMektekVehicleChoiceLabel,
  normalizeMektekVehiclePlateNumber,
} from "@/lib/mektek/customer-vehicles";
import {
  haveRequiredMektekItemInputPrices,
  mergeMektekLineItemInputs,
  parseMoney,
} from "@/lib/mektek/items";
import { getMektekTodayDateInput } from "@/lib/mektek/schedule";
import { MAX_VEHICLE_MILEAGE_KM } from "@/lib/mektek/vehicle-mileage";
import { inferMektekCustomerType } from "@/lib/mektek/customer-type";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DamageItemsInput, { DamageItem } from "./DamageItemsInput";

const NEW_CUSTOMER_VEHICLE = "NEW_CUSTOMER_VEHICLE";

type TechnicianSelection = {
  id: string | null;
  name: string;
};

type NewServiceOrderFormProps = {
  locale: string;
  initialEstimatedDone: string;
  technicians: MektekTechnicianOption[];
};

type OrderFormSectionProps = {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
};

function OrderFormSection({
  id,
  step,
  title,
  description,
  icon: Icon,
  children,
}: OrderFormSectionProps) {
  return (
    <section className="space-y-4" aria-labelledby={`${id}-title`}>
      <div className="flex items-start gap-3">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {step}
          </span>
        </div>
        <div>
          <h4 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h4>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function TechnicianSearchInput({
  id,
  selection,
  technicians,
  unavailableIds,
  disabled,
  onChange,
}: {
  id: string;
  selection: TechnicianSelection;
  technicians: MektekTechnicianOption[];
  unavailableIds: string[];
  disabled: boolean;
  onChange: (selection: TechnicianSelection) => void;
}) {
  const availableTechnicians = technicians.filter(
    (technician) =>
      technician.id === selection.id || !unavailableIds.includes(technician.id),
  );

  return (
    <>
      <Input
        id={id}
        list={`${id}-options`}
        role="combobox"
        aria-autocomplete="list"
        placeholder="Ketik nama teknisi"
        value={selection.name}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => {
          const nextQuery = event.target.value;
          const match = availableTechnicians.find(
            (item) =>
              item.name.toLocaleLowerCase("id-ID") ===
              nextQuery.trim().toLocaleLowerCase("id-ID"),
          );
          onChange(
            match
              ? { id: match.id, name: match.name }
              : { id: null, name: nextQuery },
          );
        }}
        onBlur={() => {
          const exactMatch = availableTechnicians.find(
            (item) =>
              item.name.toLocaleLowerCase("id-ID") ===
              selection.name.trim().toLocaleLowerCase("id-ID"),
          );
          if (exactMatch) {
            onChange({ id: exactMatch.id, name: exactMatch.name });
            return;
          }
          onChange({ id: null, name: selection.name.trim() });
        }}
      />
      <datalist id={`${id}-options`}>
        {availableTechnicians.map((technician) => (
          <option key={technician.id} value={technician.name} />
        ))}
      </datalist>
    </>
  );
}

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
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleFleetNumber, setVehicleFleetNumber] = useState("");
  const [vehicleMileageKm, setVehicleMileageKm] = useState("");
  const [technicianSelections, setTechnicianSelections] = useState<
    TechnicianSelection[]
  >([
    { id: null, name: "" },
    { id: null, name: "" },
    { id: null, name: "" },
  ]);
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([
    {
      clientId: "initial-service-item",
      description: "",
      estimatedCost: "",
      quantity: 1,
    },
  ]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>([]);
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"STANDARD" | "B2B">("STANDARD");
  const [address, setAddress] = useState("");
  const [estimatedDone, setEstimatedDone] = useState(initialEstimatedDone);
  const [voucherCode, setVoucherCode] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);
  const [customerVehicles, setCustomerVehicles] = useState<
    MektekCustomerSearchResult["vehicles"]
  >([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<
    MektekCustomerSearchResult[]
  >([]);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [hasCustomerSearchResult, setHasCustomerSearchResult] = useState(false);
  const [isSearchingCustomers, startCustomerSearch] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const selectedCustomerSearchRef = useRef("");

  useEffect(() => {
    const query = customerSearchQuery.trim();
    if (query.length < 2 || query === selectedCustomerSearchRef.current) {
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
  }, [customerSearchQuery]);

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

    const describedServiceItems = mergeMektekLineItemInputs(
      serviceItems.filter((item) => item.description.trim()),
    );
    const describedSparepartItems = mergeMektekLineItemInputs(
      sparepartItems.filter((item) => item.description.trim()),
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

    const selectedTechnicians = technicianSelections.filter(
      (selection) => selection.name.trim(),
    );
    if (selectedTechnicians.length < 1) {
      toast.error("Pilih minimal 1 technician");
      return;
    }
    const technicianIdentities = selectedTechnicians.map((selection) =>
      selection.name.trim().toLocaleLowerCase("id-ID"),
    );
    if (new Set(technicianIdentities).size !== technicianIdentities.length) {
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
        vehicleMileageKm,
        complaint: complaint || "-",
        technicianAssignments: selectedTechnicians.map((selection) => ({
          id: selection.id ?? undefined,
          name: selection.name.trim(),
        })),
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
      selectedCustomerSearchRef.current = "";
      setCustomerSearchQuery("");
      setCustomerName("");
      setVehicle("");
      setVehiclePlateNumber("");
      setVehicleFleetNumber("");
      setVehicleMileageKm("");
      setTechnicianSelections([
        { id: null, name: "" },
        { id: null, name: "" },
        { id: null, name: "" },
      ]);
      setServiceItems([
        {
          clientId: "initial-service-item",
          description: "",
          estimatedCost: "",
          quantity: 1,
        },
      ]);
      setSparepartItems([]);
      setPhone("");
      setCustomerType("STANDARD");
      setAddress("");
      setEstimatedDone(getMektekTodayDateInput());
      setVoucherCode("");
      setCustomerVehicles([]);
      setSelectedVehicleId("");
      setCustomerSuggestions([]);
      setCustomerSuggestionsOpen(false);
      setHasCustomerSearchResult(false);
      setFormResetKey((key) => key + 1);
      router.refresh();
    });
  };

  const selectCustomer = (customer: MektekCustomerSearchResult) => {
    const normalizedPlateQuery = normalizeMektekVehiclePlateNumber(
      customerSearchQuery,
    );
    const matchedVehicle = /\d/.test(normalizedPlateQuery)
      ? customer.vehicles.find((customerVehicle) =>
          normalizeMektekVehiclePlateNumber(
            customerVehicle.plateNumber,
          ).includes(normalizedPlateQuery),
        )
      : undefined;
    const preferredVehicle = matchedVehicle ?? customer.vehicles[0];
    selectedCustomerSearchRef.current = customer.name;
    setCustomerSearchQuery(customer.name);
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setCustomerType(customer.customerType);
    setCustomerVehicles(customer.vehicles);
    setSelectedVehicleId(preferredVehicle?.id ?? NEW_CUSTOMER_VEHICLE);
    setVehicle(preferredVehicle?.name ?? customer.vehicleName ?? "");
    setVehiclePlateNumber(
      preferredVehicle?.plateNumber ?? customer.vehiclePlateNumber ?? "",
    );
    setVehicleFleetNumber(
      preferredVehicle?.fleetNumber ?? customer.vehicleFleetNumber ?? "",
    );
    if (customer.address && !address.trim()) {
      setAddress(customer.address);
    }
    setCustomerSuggestions([]);
    setCustomerSuggestionsOpen(false);
    setHasCustomerSearchResult(false);
  };

  const selectCustomerVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (vehicleId === NEW_CUSTOMER_VEHICLE) {
      setVehicle("");
      setVehiclePlateNumber("");
      setVehicleFleetNumber("");
      setVehicleMileageKm("");
      return;
    }

    const selectedVehicle = customerVehicles.find(
      (item) => item.id === vehicleId,
    );
    if (!selectedVehicle) return;
    setVehicle(selectedVehicle.name);
    setVehiclePlateNumber(selectedVehicle.plateNumber);
    setVehicleFleetNumber(selectedVehicle.fleetNumber ?? "");
    setVehicleMileageKm("");
  };

  const copyLink = async () => {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Link tracking pelanggan disalin");
  };

  const selectedTechnicianCount = technicianSelections.filter(
    (selection) => selection.name.trim(),
  ).length;
  const serviceEstimatedCost = serviceItems.reduce(
    (total, item) =>
      total +
      parseMoney(item.estimatedCost) * Math.max(1, Number(item.quantity) || 1),
    0,
  );
  const sparepartEstimatedCost = sparepartItems.reduce(
    (total, item) =>
      total +
      parseMoney(item.estimatedCost) * Math.max(1, Number(item.quantity) || 1),
    0,
  );
  const totalEstimatedCost = serviceEstimatedCost + sparepartEstimatedCost;

  return (
    <div className="flex flex-col gap-4">
      <form
        key={formResetKey}
        ref={formRef}
        onSubmit={onSubmit}
        className="flex flex-col gap-6 rounded-xl border bg-card p-5 md:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Penerimaan Servis
            </p>
            <h3 className="mt-1 text-xl font-semibold">Buat Order Servis</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Ikuti empat bagian di bawah agar data pelanggan, kendaraan, dan
              estimasi pekerjaan tercatat dengan lengkap.
            </p>
          </div>
          <Badge variant="outline" className="w-fit shrink-0">
            Admin / CS
          </Badge>
        </div>

        <Separator className="h-0.5 bg-border" />

        <OrderFormSection
          id="customer-section"
          step={1}
          title="Data Pelanggan"
          description="Cari pelanggan lama atau isi identitas pelanggan baru."
          icon={UserRound}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-muted/20 p-4 md:col-span-2">
            <div>
              <p className="text-sm font-semibold">Pilih pelanggan lama</p>
              <p className="text-xs text-muted-foreground">
                Opsional. Cari dulu agar data pelanggan tidak tersimpan ganda.
              </p>
            </div>
            <Label htmlFor="customer-search" className="sr-only">
              Cari pelanggan tersimpan
            </Label>
            <div className="relative">
              <Input
                id="customer-search"
                placeholder="Cari nama pelanggan atau plat kendaraan"
                value={customerSearchQuery}
                onFocus={() => {
                  if (customerSuggestions.length > 0) {
                    setCustomerSuggestionsOpen(true);
                  }
                }}
                onBlur={() => setCustomerSuggestionsOpen(false)}
                onChange={(event) => {
                  selectedCustomerSearchRef.current = "";
                  setCustomerSearchQuery(event.target.value);
                  setCustomerVehicles([]);
                  setSelectedVehicleId("");
                  setCustomerSuggestionsOpen(true);
                }}
                disabled={isPending}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={customerSuggestionsOpen}
                aria-controls="mektek-customer-suggestions"
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
                        Mencari pelanggan atau plat kendaraan...
                      </div>
                    )}
                    {!isSearchingCustomers &&
                      customerSuggestions.map((customer) => (
                        <button
                          key={`${customer.source}-${customer.id}`}
                          type="button"
                          className="flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="text-sm font-medium">
                            {customer.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {customer.phone}
                            {customer.customerType === "B2B"
                              ? " · Perusahaan"
                              : ""}
                            {customer.address ? ` · ${customer.address}` : ""}
                          </span>
                          {customer.vehicles.length > 0 && (
                            <span className="text-xs font-medium text-foreground/80">
                              Plat: {customer.vehicles
                                .slice(0, 3)
                                .map((vehicle) => vehicle.plateNumber)
                                .join(", ")}
                            </span>
                          )}
                        </button>
                      ))}
                    {!isSearchingCustomers &&
                      hasCustomerSearchResult &&
                      customerSuggestions.length === 0 && (
                        <div className="px-3 py-2.5 text-xs text-muted-foreground">
                          Pelanggan atau plat tidak ditemukan. Isi data pelanggan
                          baru di bawah.
                        </div>
                      )}
                  </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cari dengan nama atau nomor plat, lalu pilih pelanggan untuk mengisi
              data otomatis.
            </p>
          </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-name">
                Nama pelanggan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                placeholder="Contoh: Budi Santoso atau PT Maju Jaya"
                value={customerName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setCustomerName(nextName);
                  setCustomerType(
                    inferMektekCustomerType(nextName, "STANDARD"),
                  );
                }}
                disabled={isPending}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone">
                Nomor telepon <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-phone"
                placeholder="Contoh: 0812 3456 7890"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={isPending}
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-type">Jenis pelanggan</Label>
              <Input
                id="customer-type"
                value={
                  customerType === "B2B"
                    ? "Perusahaan"
                    : "Pelanggan standar"
                }
                readOnly
                aria-readonly="true"
              />
              <p className="text-xs text-muted-foreground">
                Terdeteksi otomatis dari data pelanggan yang dipilih atau nama
                pelanggan baru.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-address">
                Alamat <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="customer-address"
                placeholder="Alamat pelanggan"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                disabled={isPending}
                autoComplete="street-address"
              />
            </div>
          </div>
        </OrderFormSection>

        <Separator className="h-0.5 bg-border" />

        <OrderFormSection
          id="vehicle-section"
          step={2}
          title="Data Kendaraan"
          description="Pastikan kendaraan, nomor plat, dan kilometer sesuai saat diterima."
          icon={CarFront}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {customerVehicles.length > 0 && (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="customer-vehicle-select">
                Pilih kendaraan / nomor plat
              </Label>
              <Select
                value={selectedVehicleId}
                onValueChange={selectCustomerVehicle}
                disabled={isPending}
              >
                <SelectTrigger id="customer-vehicle-select">
                  <SelectValue placeholder="Pilih kendaraan pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {customerVehicles.map((customerVehicle) => (
                      <SelectItem
                        key={customerVehicle.id}
                        value={customerVehicle.id}
                      >
                        {formatMektekVehicleChoiceLabel(customerVehicle)}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_CUSTOMER_VEHICLE}>
                      Gunakan kendaraan baru
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {customerVehicles.length} kendaraan tersimpan untuk pelanggan ini.
              </p>
            </div>
          )}
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-name">
                Kendaraan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vehicle-name"
                placeholder="Contoh: Toyota Avanza 2021"
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-plate">
                Nomor plat <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vehicle-plate"
                placeholder="Contoh: DK 1234 AB"
                value={vehiclePlateNumber}
                onChange={(event) => {
                  setSelectedVehicleId(NEW_CUSTOMER_VEHICLE);
                  setVehiclePlateNumber(event.target.value.toUpperCase());
                }}
                disabled={isPending}
                autoCapitalize="characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-mileage">
                Kilometer saat masuk{" "}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="vehicle-mileage"
                placeholder="Contoh: 42500"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_VEHICLE_MILEAGE_KM}
                step={1}
                value={vehicleMileageKm}
                onChange={(event) =>
                  setVehicleMileageKm(event.target.value.replace(/\D/g, ""))
                }
                disabled={isPending}
              />
            </div>
          {customerType === "B2B" && (
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-fleet-number">
                Nomor lambung{" "}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="vehicle-fleet-number"
                placeholder="Contoh: UNIT-017"
                value={vehicleFleetNumber}
                onChange={(event) => setVehicleFleetNumber(event.target.value)}
                disabled={isPending}
              />
            </div>
          )}
          </div>
        </OrderFormSection>

        <Separator className="h-0.5 bg-border" />

        <OrderFormSection
          id="assignment-section"
          step={3}
          title="Penugasan & Jadwal"
          description="Tetapkan target selesai dan tim yang bertanggung jawab."
          icon={CalendarClock}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:max-w-sm">
              <Label htmlFor="estimated-done">Estimasi selesai</Label>
              <Input
                id="estimated-done"
                type="date"
                value={estimatedDone}
                onChange={(event) => setEstimatedDone(event.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Tanggal ini dapat diperbarui setelah pemeriksaan teknisi.
              </p>
            </div>
          <fieldset className="rounded-lg border bg-muted/20 p-4 md:col-span-2">
            <legend className="sr-only">Tim Technician</legend>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="rounded-md border bg-background p-2 text-muted-foreground">
                  <UsersRound className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tim Technician</p>
                  <p className="text-xs text-muted-foreground">
                    Pilih teknisi utama dan maksimal dua pendamping.
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {selectedTechnicianCount}/3 dipilih
              </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {["Teknisi utama", "Pendamping 1", "Pendamping 2"].map(
                (slotLabel, slot) => (
                  <div key={slotLabel} className="space-y-1.5">
                    <Label htmlFor={`technician-search-${slot}`}>
                      {slotLabel}
                      {slot > 0 && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          (opsional)
                        </span>
                      )}
                    </Label>
                    <TechnicianSearchInput
                      id={`technician-search-${slot}`}
                      selection={technicianSelections[slot]}
                      technicians={technicians}
                      unavailableIds={technicianSelections
                        .filter(
                          (_selection, selectedSlot) =>
                            selectedSlot !== slot,
                        )
                        .map((selection) => selection.id)
                        .filter((id): id is string => !!id)}
                      disabled={isPending}
                      onChange={(value) =>
                        setTechnicianSelections((current) =>
                          current.map((item, index) =>
                            index === slot ? value : item,
                          ),
                        )
                      }
                    />
                  </div>
                ),
              )}
            </div>
            </fieldset>
          </div>
        </OrderFormSection>

        <Separator className="h-0.5 bg-border" />

        <OrderFormSection
          id="work-section"
          step={4}
          title="Pekerjaan & Estimasi"
          description="Rinci pekerjaan dan sparepart per baris agar biaya mudah dipahami pelanggan."
          icon={ClipboardList}
        >
          <div className="space-y-6">
            <DamageItemsInput
              items={serviceItems}
              onChange={setServiceItems}
              label="Pekerjaan Servis"
              helperText="Tambahkan satu baris untuk setiap keluhan atau pekerjaan yang akan dilakukan."
              itemLabel="Pekerjaan"
              descriptionLabel="Keluhan / pekerjaan"
              addLabel="Tambah pekerjaan"
              disabled={isPending}
            />

            <Separator className="h-0.5 bg-border" />

            <DamageItemsInput
              items={sparepartItems}
              onChange={setSparepartItems}
              label="Sparepart"
              helperText="Opsional. Cari dari katalog atau masukkan sparepart manual jika diperlukan."
              itemLabel="Sparepart"
              descriptionLabel="Nama sparepart"
              addLabel="Tambah sparepart"
              emptyMessage="Belum ada sparepart"
              descriptionPlaceholder={(index) =>
                `Sparepart #${index + 1} (contoh: filter oli)`
              }
              minimumItems={0}
              catalogSearch
              disabled={isPending}
            />

            <div className="space-y-1.5">
              <Label htmlFor="voucher-code">
                Kode voucher{" "}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="voucher-code"
                placeholder="Masukkan kode voucher"
                value={voucherCode}
                onChange={(event) =>
                  setVoucherCode(event.target.value.toUpperCase())
                }
                disabled={isPending}
                autoCapitalize="characters"
                className="md:max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                Voucher dan diskon loyalitas divalidasi saat order disimpan.
              </p>
            </div>
          </div>
        </OrderFormSection>

        <div className="relative flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          {successBurstKey > 0 && (
            <ServiceCreatedBurst key={successBurstKey} />
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Total estimasi order
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">
              Rp {totalEstimatedCost.toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Servis Rp {serviceEstimatedCost.toLocaleString("id-ID")} ·
              Sparepart Rp {sparepartEstimatedCost.toLocaleString("id-ID")}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending && (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            )}
            {isPending ? "Menyimpan order..." : "Buat Order Servis"}
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
