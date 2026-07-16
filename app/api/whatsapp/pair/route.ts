import qrcode from "qrcode";
import { getSessionUser } from "@/lib/auth-guards";
import { getWhatsAppDriverName } from "@/lib/whatsapp";
import { acquireWhatsAppLease } from "@/lib/whatsapp/lease";
import type { PairingEvent } from "@/lib/whatsapp/drivers/baileys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This is the whole trick that makes QR pairing work without a server.
//
// A WhatsApp pairing cannot be done across requests: the socket that shows you the
// QR is the same socket that must still be alive when you scan it, and serverless
// keeps nothing between invocations. So instead of polling, we hold ONE invocation
// open and stream the QR out of it over SSE. The socket lives for exactly as long
// as this response does.
//
// 300s is the Fluid compute ceiling on Hobby, and is far more than a scan needs.
export const maxDuration = 300;

// Stop streaming a little before the platform kills us, so the admin gets a real
// "expired, try again" instead of a truncated connection.
const PAIRING_BUDGET_MS = 280_000;

export async function GET(request: Request) {
  // Pairing links a device to the business WhatsApp — admin only, never plain staff.
  const user = await getSessionUser();
  if (!user?.id) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (getWhatsAppDriverName() !== "baileys") {
    return Response.json(
      { error: "Pairing over SSE requires the baileys driver." },
      { status: 400 }
    );
  }

  // Take the connection lease up front: if a send is in flight, connecting now
  // would get one of the two sockets kicked off.
  const lease = await acquireWhatsAppLease({ ttlMs: 60_000, waitMs: 10_000 });
  if (!lease) {
    return Response.json(
      { error: "WhatsApp is busy sending a message. Try again in a moment." },
      { status: 409 }
    );
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  // The admin closing the tab must tear the socket down; otherwise it would sit
  // holding the lease until the invocation times out.
  request.signal.addEventListener("abort", () => abortController.abort(), {
    once: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const write = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const budget = setTimeout(() => abortController.abort(), PAIRING_BUDGET_MS);

      try {
        write("status", { status: "connecting" });

        const { runPairing } = await import("@/lib/whatsapp/drivers/baileys");

        await runPairing({
          signal: abortController.signal,
          heartbeat: () => lease.heartbeat(60_000),
          emit: (event: PairingEvent) => {
            if (event.type === "qr") {
              // Render server-side so the browser just shows an <img> — the raw QR
              // payload is a pairing secret and doesn't need to be handled client-side.
              qrcode
                .toDataURL(event.qr)
                .then((qrDataUrl) => write("qr", { qrDataUrl }))
                .catch((error) =>
                  write("error", {
                    message: error instanceof Error ? error.message : String(error),
                  })
                );
              return;
            }

            if (event.type === "linked") {
              write("linked", { sessionPhone: event.sessionPhone });
              return;
            }

            write("error", { message: event.message });
          },
        });
      } catch (error) {
        if (!abortController.signal.aborted) {
          write("error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        clearTimeout(budget);
        await lease.release().catch(() => {});
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Already closed by the client disconnecting.
          }
        }
      }
    },

    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Defensive: some proxies buffer streamed responses, which would hold the QR
      // until the stream ended — i.e. until long after it had expired.
      "X-Accel-Buffering": "no",
    },
  });
}
