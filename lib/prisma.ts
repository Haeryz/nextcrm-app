import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var cachedPrisma: PrismaClient | undefined;
}

function createMockPrisma(): PrismaClient {
  const modelProxy = new Proxy(
    {},
    {
      get(_t, method: string) {
        if (method === "count") return () => Promise.resolve(0);
        if (method === "findMany") return () => Promise.resolve([]);
        if (method === "aggregate") return () => Promise.resolve({ _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} });
        // findFirst, findUnique, create, update, delete, upsert, etc.
        return () => Promise.resolve(null);
      },
    }
  );
  return new Proxy({} as PrismaClient, {
    get(_t, prop: string) {
      if (prop === "$connect" || prop === "$disconnect") return () => Promise.resolve();
      if (prop === "$transaction") {
        return (arg: unknown) =>
          Array.isArray(arg) ? Promise.resolve(arg.map(() => null)) : Promise.resolve(null);
      }
      return modelProxy;
    },
  });
}

// Prisma Client configuration with connection pooling and lifecycle management
const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    console.warn("[prisma] DATABASE_URL not set — using mock client (prototype mode)");
    return createMockPrisma();
  }

  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Ensure graceful shutdown on hot reload in development
  if (process.env.NODE_ENV !== "production") {
    // Clean up on process termination
    const cleanup = async () => {
      await client.$disconnect();
    };

    process.on("beforeExit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  return client;
};

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = prismaClientSingleton();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = prismaClientSingleton();
  }
  prisma = global.cachedPrisma;
}

export const prismadb = prisma;
