export const MEKTEK_SERVICE_NUMBER_PREFIX = "SRV";

type MektekServiceSequenceUpsertArgs = {
  where: { monthKey: string };
  create: { monthKey: string; lastValue: number };
  update: { lastValue: { increment: number } };
  select: { monthKey: true; lastValue: true };
};

export type MektekServiceNumberStore = {
  mektekServiceMonthlySequence: {
    upsert: (
      args: MektekServiceSequenceUpsertArgs,
    ) => PromiseLike<{ monthKey: string; lastValue: number }>;
  };
};

export function getMektekServiceMonthKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal nomor service tidak valid");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}${month}`;
}

export function formatMektekServiceNumber(monthKey: string, sequence: number) {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error("Bulan nomor service harus menggunakan format YYYYMM");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Urutan nomor service harus berupa bilangan positif");
  }

  return `${MEKTEK_SERVICE_NUMBER_PREFIX}-${monthKey}-${String(sequence).padStart(
    4,
    "0",
  )}`;
}

export async function reserveMektekServiceNumber(
  store: MektekServiceNumberStore,
  date = new Date(),
) {
  const monthKey = getMektekServiceMonthKey(date);
  const sequence = await store.mektekServiceMonthlySequence.upsert({
    where: { monthKey },
    create: { monthKey, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { monthKey: true, lastValue: true },
  });

  return formatMektekServiceNumber(sequence.monthKey, sequence.lastValue);
}
