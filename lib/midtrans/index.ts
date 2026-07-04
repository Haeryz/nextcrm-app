import {
  areExternalApisDisabled,
  getAuthHeader,
  getClientKey,
  getCoreApiBaseUrl,
  getSnapBaseUrl,
} from "@/lib/midtrans/client";

export {
  getClientKey,
  getSnapScriptUrl,
  interpretTransactionStatus,
  isMidtransProduction,
  verifyNotificationSignature,
} from "@/lib/midtrans/client";
export type { MidtransStatusVerdict } from "@/lib/midtrans/client";

export type MidtransItem = {
  id?: string;
  name: string;
  price: number;
  quantity: number;
};

export type MidtransCustomer = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export type CreateSnapTransactionParams = {
  orderId: string;
  grossAmount: number;
  customer?: MidtransCustomer;
  items?: MidtransItem[];
  /** Optional finish/callback redirect URL shown after payment. */
  finishUrl?: string;
};

export type SnapTransactionResult =
  | { ok: true; token: string; redirectUrl: string; clientKey: string }
  | { ok: false; error: string };

export type TransactionStatusResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Create a Snap transaction token. We intentionally DO NOT send `enabled_payments`
 * so that every method enabled in the Snap Preference dashboard is offered.
 */
export async function createSnapTransaction(
  params: CreateSnapTransactionParams
): Promise<SnapTransactionResult> {
  if (areExternalApisDisabled()) {
    return { ok: false, error: "External APIs are disabled" };
  }

  const orderId = String(params.orderId ?? "").trim();
  if (!orderId || orderId.length > 50) {
    return { ok: false, error: "Invalid order id" };
  }

  const grossAmount = Math.round(Number(params.grossAmount));
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return { ok: false, error: "Invalid gross amount" };
  }

  // Midtrans requires sum(item_details) === gross_amount when item_details are present.
  const items = params.items?.filter((item) => item && item.quantity > 0) ?? [];
  const itemsTotal = items.reduce(
    (sum, item) => sum + Math.round(item.price) * Math.round(item.quantity),
    0
  );
  const includeItems = items.length > 0 && itemsTotal === grossAmount;

  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
  };

  if (includeItems) {
    body.item_details = items.map((item) => ({
      id: item.id,
      name: String(item.name).slice(0, 50),
      price: Math.round(item.price),
      quantity: Math.round(item.quantity),
    }));
  }

  const customer = params.customer;
  if (customer) {
    body.customer_details = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
    };
  }

  if (params.finishUrl) {
    body.callbacks = { finish: params.finishUrl };
  }

  try {
    const response = await fetch(`${getSnapBaseUrl()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json().catch(() => null)) as
      | { token?: string; redirect_url?: string; error_messages?: string[] }
      | null;

    if (!response.ok || !json?.token) {
      const message =
        json?.error_messages?.join(", ") ||
        `Midtrans responded with status ${response.status}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      token: json.token,
      redirectUrl: json.redirect_url ?? "",
      clientKey: getClientKey(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Server-to-server authoritative status lookup for a given order id. */
export async function getTransactionStatus(
  orderId: string
): Promise<TransactionStatusResult> {
  if (areExternalApisDisabled()) {
    return { ok: false, error: "External APIs are disabled" };
  }

  const id = String(orderId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid order id" };

  try {
    const response = await fetch(
      `${getCoreApiBaseUrl()}/v2/${encodeURIComponent(id)}/status`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getAuthHeader(),
        },
      }
    );

    const json = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!json) {
      return { ok: false, error: `Midtrans status returned ${response.status}` };
    }

    return { ok: true, data: json };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
