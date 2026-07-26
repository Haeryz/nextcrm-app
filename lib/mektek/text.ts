// Leaf module: text bounds shared by Mektek server actions AND by client
// components (via lib/mektek/logistics.ts).
//
// Deliberately kept free of any import — in particular `@/lib/phone`, which pulls
// in libphonenumber-js (~183 KB parsed, with embedded metadata). `sanitize.ts`
// needs that dependency; `boundedText` does not, and client bundles that only
// want `boundedText` must not pay for it. The root package.json has no
// `"sideEffects": false`, so the bundler cannot tree-shake the phone import away
// on its own — the graph has to be split here.

export const MAX_NAME_LEN = 120;
export const MAX_ADDRESS_LEN = 500;
export const MAX_VEHICLE_LEN = 120;
export const MAX_VEHICLE_PLATE_NUMBER_LEN = 24;
export const MAX_VEHICLE_FLEET_NUMBER_LEN = 80;
export const MAX_COMPLAINT_LEN = 2000;

/** Collapse whitespace, trim, and hard-cap length. */
export function boundedText(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
