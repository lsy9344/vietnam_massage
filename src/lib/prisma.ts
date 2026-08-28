import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

type WorkerRuntimeContext = {
  env: {
    HYPERDRIVE?: {
      connectionString: string;
    };
  };
  ctx: object;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};
const workerClients = new WeakMap<object, PrismaClient>();

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    maxUses: 100,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 30_000
  });
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10_000,
      timeout: 30_000
    }
  } as any);
}

function getWorkerContext() {
  try {
    return getCloudflareContext() as unknown as WorkerRuntimeContext;
  } catch {
    return null;
  }
}

export function getPrismaClient() {
  const workerContext = getWorkerContext();
  if (workerContext) {
    const hyperdriveConnectionString = workerContext.env.HYPERDRIVE?.connectionString;
    if (hyperdriveConnectionString) {
      const existing = workerClients.get(workerContext.ctx);
      if (existing) {
        return existing;
      }

      const client = createPrismaClient(hyperdriveConnectionString);
      workerClients.set(workerContext.ctx, client);
      return client;
    }

    // OpenNext dev also provides a Cloudflare context, but CI/Vercel Node requests use
    // DATABASE_URL and do not have a Hyperdrive binding. A real Worker has neither direct
    // URL nor a valid reason to continue when the binding is missing.
    if (!process.env.DATABASE_URL) {
      throw new Error("Cloudflare Workers에서 HYPERDRIVE 바인딩을 찾을 수 없습니다.");
    }
  }

  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_aesthetic";
  globalForPrisma.prisma ??= createPrismaClient(connectionString);
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});
