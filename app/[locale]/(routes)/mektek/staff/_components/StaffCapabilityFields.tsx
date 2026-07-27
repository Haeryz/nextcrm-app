"use client";

import {
  STAFF_CAPABILITIES,
  STAFF_CAPABILITY_DESCRIPTIONS,
  STAFF_CAPABILITY_LABELS,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";

type StaffCapabilityFieldsProps = {
  defaultCapabilities?: StaffCapability[] | null;
};

export default function StaffCapabilityFields({
  defaultCapabilities = null,
}: StaffCapabilityFieldsProps) {
  const selected = new Set(defaultCapabilities ?? []);

  return (
    <fieldset className="col-span-full space-y-2">
      <legend className="text-sm font-medium">Kapabilitas Akses</legend>
      <p className="text-xs text-muted-foreground">
        Pilih halaman yang dapat diakses sub-admin. Main admin selalu memiliki
        akses penuh.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STAFF_CAPABILITIES.map((capability) => (
          <label
            key={capability}
            className="flex items-start gap-2 rounded-md border p-2 text-sm"
          >
            <input
              type="checkbox"
              name="staffCapabilities"
              value={capability}
              defaultChecked={selected.has(capability)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {STAFF_CAPABILITY_LABELS[capability]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {STAFF_CAPABILITY_DESCRIPTIONS[capability]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
