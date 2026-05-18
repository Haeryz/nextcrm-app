import type { NextRequest } from "next/server";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = JSON.stringify(buildMektekPublicSnapshot(initialOrder));
      const pushSnapshot = (payload: string) => {
        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${payload}\n\n`)
        );
      };

      pushSnapshot(lastPayload);

      while (!request.signal.aborted) {
        await sleep(2000);
        if (request.signal.aborted) break;

        const nextOrder = await getPublicMektekServiceOrder(id, token);
        if (!nextOrder) {
          break;
        }

        const nextPayload = JSON.stringify(buildMektekPublicSnapshot(nextOrder));
        if (nextPayload !== lastPayload) {
          lastPayload = nextPayload;
          pushSnapshot(nextPayload);
        } else {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
