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
    <fieldset className="col-span-full space-y-1.5">
      <legend className="text-sm font-medium">Kapabilitas Akses</legend>
      <div className="flex flex-wrap gap-1.5">
        {STAFF_CAPABILITIES.map((capability) => (
          <label
            key={capability}
            title={STAFF_CAPABILITY_DESCRIPTIONS[capability]}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-foreground"
          >
            <input
              type="checkbox"
              name="staffCapabilities"
              value={capability}
              defaultChecked={selected.has(capability)}
              className="size-3.5"
            />
            {STAFF_CAPABILITY_LABELS[capability]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
