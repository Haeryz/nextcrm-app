import { Resend } from "resend";
import { areExternalApisDisabled } from "./external-apis";

type ResendLike = {
  emails: {
    send: (...args: any[]) => Promise<{ data: null; error: null }>;
  };
};

const noopResend: ResendLike = {
  emails: {
    send: async () => ({ data: null, error: null }),
  },
};

export default async function resendHelper() {
  if (areExternalApisDisabled()) {
    return noopResend;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);

  return resend;
}
