import type { NextRequest } from "next/server";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Each open connection runs a per-connection DB poll. Bound the cost:
//  - MAX_LIFETIME_MS: force-close long-lived connections; the client (EventSource)
//    reconnects automatically, so this is transparent but caps runaway sessions.
//  - Poll interval backs off from BASE to MAX while the snapshot is unchanged, so
//    an idle order is cheap; it resets to BASE as soon as something changes.
//  - MAX_CONCURRENT caps how many streams a single Node instance will serve at once
//    to blunt a connection-flood DoS.
const MAX_LIFETIME_MS = 10 * 60 * 1000;
const BASE_POLL_MS = 2000;
const MAX_POLL_MS = 15000;
const MAX_CONCURRENT = 200;

let activeStreams = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";

  const initialOrder = await getPublicMektekServiceOrder(id, token);
  if (!initialOrder) {
    return new Response("Not found", { status: 404 });
  }

  if (activeStreams >= MAX_CONCURRENT) {
    // Shed load: the client falls back to its initial snapshot and may retry later.
    return new Response("Too many connections", {
      status: 503,
      headers: { "Retry-After": "30", "Referrer-Policy": "no-referrer" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      activeStreams += 1;
      const startedAt = Date.now();
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        activeStreams -= 1;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      let lastPayload = JSON.stringify(buildMektekPublicSnapshot(initialOrder));
      let pollMs = BASE_POLL_MS;
      const pushSnapshot = (payload: string) => {
        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${payload}\n\n`)
        );
      };

      try {
        pushSnapshot(lastPayload);

        while (!request.signal.aborted) {
          if (Date.now() - startedAt >= MAX_LIFETIME_MS) break;

          await sleep(pollMs);
          if (request.signal.aborted) break;

          const nextOrder = await getPublicMektekServiceOrder(id, token);
          if (!nextOrder) {
            break;
          }

          const nextPayload = JSON.stringify(buildMektekPublicSnapshot(nextOrder));
          if (nextPayload !== lastPayload) {
            lastPayload = nextPayload;
            pollMs = BASE_POLL_MS; // activity → poll fast again
            pushSnapshot(nextPayload);
          } else {
            // Idle → back off the poll interval and keep the connection warm.
            pollMs = Math.min(pollMs * 2, MAX_POLL_MS);
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
