import { prismadb } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
};

// Which build is live. Baked into the image by the Build and publish workflow
// (APP_COMMIT_SHA / APP_BUILD_TIME); "unknown" for local or non-CI builds.
// startedAt changes whenever the container restarts, e.g. after the VPS
// poller pulls a new :production image.
const commit = process.env.APP_COMMIT_SHA || "unknown";
const version = {
  commit,
  shortCommit: commit === "unknown" ? commit : commit.slice(0, 12),
  builtAt: process.env.APP_BUILD_TIME || "unknown",
  startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
};

export async function GET() {
  try {
    await prismadb.$queryRaw`SELECT 1 AS ok`;

    return Response.json(
      {
        status: "ready",
        database: "reachable",
        version,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        database: "unreachable",
        version,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
