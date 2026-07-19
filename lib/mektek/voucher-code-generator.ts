import { randomInt } from "crypto";

import {
  cleanMektekVoucherCode,
  normalizeMektekVoucherCode,
} from "@/lib/mektek/vouchers";

export const VOUCHER_RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DEFAULT_VOUCHER_RANDOM_LENGTH = 10;
export const MAX_VOUCHER_DICTIONARY_ENTRIES = 500;

type RandomIndex = (maxExclusive: number) => number;

function secureRandomIndex(maxExclusive: number) {
  return randomInt(maxExclusive);
}

export function generatePureRandomVoucherCode(
  length = DEFAULT_VOUCHER_RANDOM_LENGTH,
  randomIndex: RandomIndex = secureRandomIndex
) {
  const safeLength = Math.min(Math.max(Math.floor(length), 6), 40);
  return Array.from(
    { length: safeLength },
    () => VOUCHER_RANDOM_ALPHABET[randomIndex(VOUCHER_RANDOM_ALPHABET.length)]
  ).join("");
}

export function sanitizeVoucherDictionaryEntries(input: string | string[]) {
  const entries = Array.isArray(input) ? input : input.split(/[\n,]+/);
  const unique = new Map<string, string>();

  for (const entry of entries) {
    const code = normalizeMektekVoucherCode(entry).slice(0, 40);
    const normalized = cleanMektekVoucherCode(code);
    if (normalized.length < 3 || unique.has(normalized)) continue;
    unique.set(normalized, code);
    if (unique.size >= MAX_VOUCHER_DICTIONARY_ENTRIES) break;
  }

  return [...unique.values()];
}

export function pickDictionaryVoucherCode(
  entries: string[],
  excludedNormalizedCodes: Set<string>,
  randomIndex: RandomIndex = secureRandomIndex
) {
  const available = sanitizeVoucherDictionaryEntries(entries).filter(
    (entry) => !excludedNormalizedCodes.has(cleanMektekVoucherCode(entry))
  );
  if (available.length === 0) return null;
  return available[randomIndex(available.length)];
}
