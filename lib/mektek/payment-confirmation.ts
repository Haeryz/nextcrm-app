export type PaymentSyncResult = {
  error?: string;
  data?: {
    status?: string;
  };
};

type ConfirmPaymentOptions = {
  attempts?: number;
  delayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Midtrans can invoke Snap's success callback a fraction before its status API
 * exposes settlement. Retry briefly so the application does not leave a
 * successful payment in a pending state until a webhook arrives.
 */
export async function confirmPaymentWithRetry<T extends PaymentSyncResult>(
  sync: () => Promise<T>,
  options: ConfirmPaymentOptions = {}
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 4));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? 500));
  const sleep = options.sleep ?? defaultSleep;

  let result = await sync();
  for (let attempt = 1; attempt < attempts && result.data?.status !== "paid"; attempt += 1) {
    await sleep(delayMs * 2 ** (attempt - 1));
    result = await sync();
  }

  return result;
}
