const DAY_MS = 86_400_000;

export type ContractReminderDemoCandidate = {
  contractNumber: string;
  customer: string;
  endDate: Date | string | null;
};

export type ContractReminderDemo = {
  contractNumber: string;
  customer: string;
  endDate: string;
  simulatedAt: string;
  daysRemaining: 7;
};

export function buildContractReminderDemo(
  candidates: ContractReminderDemoCandidate[],
  now = new Date(),
): ContractReminderDemo {
  const candidate = candidates.find((row) => {
    if (!row.endDate) return false;
    return !Number.isNaN(new Date(row.endDate).getTime());
  });

  const endDate = candidate?.endDate
    ? new Date(candidate.endDate)
    : new Date(now.getTime() + 7 * DAY_MS);

  return {
    contractNumber: candidate?.contractNumber || "KONTRAK-DEMO-001",
    customer: candidate?.customer || "Pelanggan Demo",
    endDate: endDate.toISOString(),
    simulatedAt: new Date(endDate.getTime() - 7 * DAY_MS).toISOString(),
    daysRemaining: 7,
  };
}
