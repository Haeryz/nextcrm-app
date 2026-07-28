import { prismadb } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
};

export async function GET() {
  try {
    await prismadb.$queryRaw`SELECT 1 AS ok`;

    return Response.json(
      {
        status: "ready",
        database: "reachable",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
