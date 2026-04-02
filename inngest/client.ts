import { Inngest } from "inngest";
import { areExternalApisDisabled } from "@/lib/external-apis";

const client = new Inngest({
  id: process.env.INNGEST_ID || "nextcrm-prototype",
  name: process.env.INNGEST_APP_NAME || "nextcrm-prototype",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

if (areExternalApisDisabled()) {
  client.send = (async () => undefined) as any;
}

export const inngest = client;
