import { Resend } from "resend";
import { prismadb } from "./prisma";
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

  const resendKey = await prismadb.systemServices.findFirst({
    where: {
      name: "resend_smtp",
    },
  });

  const apiKey = process.env.RESEND_API_KEY || resendKey?.serviceKey;

  if (!apiKey) {
    throw new Error("Resend API key is not configured. Please add it in Admin settings or set RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(apiKey);

  return resend;
}
