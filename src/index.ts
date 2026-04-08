import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { loadConfig } from "./config.js";
import { type DiscoveredQueue, QueueDiscovery } from "./discovery.js";
import { logger } from "./logger.js";
import { rateLimiter } from "./middleware/rate-limit.js";

const config = loadConfig();
const app = new Hono();
const discovery = new QueueDiscovery(config.redisInstances);

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  }),
);

// CORS
app.use(cors({ origin: config.corsOrigin || "*" }));

// Rate limiting
app.use(
  rateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
  }),
);

// Request timeout
app.use(timeout(config.requestTimeoutMs));

// Health check — reflects actual Redis connectivity (no topology details)
app.get("/healthz", (c) => {
  const status = discovery.getConnectionStatus();
  const anyConnected = [...status.values()].some((v) => v);

  if (!anyConnected) {
    return c.json({ status: "unhealthy" }, 503);
  }
  return c.json({ status: "ok" });
});

// Basic auth — only if both username and password are set
if (config.authUsername && config.authPassword) {
  app.use(
    `${config.basePath}*`,
    basicAuth({
      username: config.authUsername,
      password: config.authPassword,
    }),
  );
  logger.info("Basic auth enabled");
} else {
  logger.warn(
    "Authentication is NOT configured. Dashboard is publicly accessible. " +
      "Set AUTH_USERNAME and AUTH_PASSWORD to enable basic auth.",
  );
}

const serverAdapter = new HonoAdapter(serveStatic);
serverAdapter.setBasePath(config.basePath);

const { setQueues } = createBullBoard({
  queues: [],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: "Bull Board",
    },
  },
});

app.route(config.basePath, serverAdapter.registerPlugin());

// Incremental board sync — only creates/removes adapters for changed queues
const adapterMap = new Map<string, BullMQAdapter>();

function syncBoard(discovered: DiscoveredQueue[]) {
  const currentKeys = new Set(discovered.map((dq) => dq.key));

  // Remove stale adapters
  for (const key of adapterMap.keys()) {
    if (!currentKeys.has(key)) adapterMap.delete(key);
  }

  // Add new adapters
  for (const dq of discovered) {
    if (!adapterMap.has(dq.key)) {
      adapterMap.set(
        dq.key,
        new BullMQAdapter(dq.queue, {
          displayName:
            config.redisInstances.length > 1
              ? `[${dq.instanceName}] ${dq.queueName}`
              : dq.queueName,
          description:
            config.redisInstances.length > 1
              ? `Redis: ${dq.instanceName}`
              : undefined,
        }),
      );
    }
  }

  setQueues([...adapterMap.values()]);
}

async function main() {
  await discovery.start(config.queueDiscoveryInterval, syncBoard);

  const server = serve({ fetch: app.fetch, port: config.port }, () => {
    logger.info(
      `Bull Board running at http://localhost:${config.port}${config.basePath}`,
    );
    logger.info(`Monitoring ${config.redisInstances.length} Redis instance(s)`);
    logger.info(`Queue discovery interval: ${config.queueDiscoveryInterval}ms`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");

    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      logger.error("Forced exit after timeout");
      process.exit(1);
    }, 10_000).unref();

    // Stop accepting new connections, drain inflight requests
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await discovery.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Fatal error: ${message}`);
  process.exit(1);
});
