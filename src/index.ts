import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { loadConfig } from "./config.js";
import { type DiscoveredQueue, QueueDiscovery } from "./discovery.js";
import { logger } from "./logger.js";

const config = loadConfig();
const app = new Hono();
const discovery = new QueueDiscovery(config.redisInstances);

// Health check — reflects actual Redis connectivity
app.get("/healthz", (c) => {
  const status = discovery.getConnectionStatus();
  const anyConnected = [...status.values()].some((v) => v);
  const redis = Object.fromEntries(status);

  if (!anyConnected) {
    return c.json({ status: "unhealthy", redis }, 503);
  }
  return c.json({ status: "ok", redis });
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

function syncBoard(discovered: DiscoveredQueue[]) {
  const adapters = discovered.map(
    (dq) =>
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
  setQueues(adapters);
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
