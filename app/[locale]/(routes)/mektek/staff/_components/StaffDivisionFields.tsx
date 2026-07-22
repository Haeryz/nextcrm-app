"use client";

import { useEffect, useRef, useState } from "react";

import {
  LOGISTICS_STAFF_AREAS,
  LOGISTICS_STAFF_AREA_LABELS,
  type LogisticsStaffArea,
} from "@/lib/auth/logistics-staff-areas";
import {
  STAFF_DIVISIONS,
  STAFF_DIVISION_LABELS,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type StaffDivisionFieldsProps = {
  defaultDivision?: StaffDivision | null;
  defaultLogisticsArea?: LogisticsStaffArea | null;
};

export default function StaffDivisionFields({
  defaultDivision = null,
  defaultLogisticsArea = null,
}: StaffDivisionFieldsProps) {
  const initialDivision = defaultDivision ?? "";
  const [division, setDivision] = useState<StaffDivision | "">(initialDivision);
  const divisionSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const form = divisionSelectRef.current?.closest("form");
    const resetDivision = () => setDivision(initialDivision);
    form?.addEventListener("reset", resetDivision);
    return () => form?.removeEventListener("reset", resetDivision);
  }, [initialDivision]);

  return (
    <>
      <select
        ref={divisionSelectRef}
        name="staffDivision"
        className={selectClass}
        value={division}
        onChange={(event) =>
          setDivision(event.target.value as StaffDivision | "")
        }
        aria-label="Divisi staff"
        required
      >
        <option value="" disabled>
          Pilih divisi
        </option>
        {STAFF_DIVISIONS.map((option) => (
          <option key={option} value={option}>
            {STAFF_DIVISION_LABELS[option]}
          </option>
        ))}
      </select>

      {division === "LOGISTICS" ? (
        <select
          name="logisticsStaffArea"
          className={selectClass}
          defaultValue={defaultLogisticsArea ?? ""}
          aria-label="Bagian Logistics"
          required
        >
          <option value="" disabled>
            Pilih bagian Logistics
          </option>
          {LOGISTICS_STAFF_AREAS.map((area) => (
            <option key={area} value={area}>
              {LOGISTICS_STAFF_AREA_LABELS[area]}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="logisticsStaffArea" value="" />
      )}
    </>
  );
}
