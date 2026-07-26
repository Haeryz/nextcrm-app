/**
 * Outcome vocabulary shared by the page (GET) and the confirm action (POST).
 *
 * Plain module on purpose: `actions.ts` is a "use server" file and may only
 * export async functions, so these values cannot live there.
 */
export type WhatsAppOptOutOutcome =
  | "confirm" // token valid, waiting for the customer to press the button
  | "success" // just opted out in this request
  | "already" // customer had already opted out before
  | "used" // token was already spent
  | "expired" // token is past its expiry
  | "invalid" // token missing, malformed, or unknown
  | "error"; // something broke on our side

export type WhatsAppOptOutState = {
  outcome: WhatsAppOptOutOutcome;
  /** Display name of the customer, when we could resolve one. */
  customerName?: string | null;
};
