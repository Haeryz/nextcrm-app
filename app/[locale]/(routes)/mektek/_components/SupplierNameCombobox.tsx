"use client";

import { Input } from "@/components/ui/input";

/**
 * Input teks bebas dengan dropdown saran nama pemasok dari Laporan Hutang
 * Pemasok. Karyawan bisa memilih dari daftar ATAU mengetik nama baru yang
 * belum terdaftar — perilkunya mengikuti <datalist> bawaan browser.
 */
export default function SupplierNameCombobox({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const listId = `${id}-supplier-suggestions`;
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
