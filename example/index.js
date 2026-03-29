import { Queue, Worker } from "bullmq";

function buildConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.pathname.length > 1 ? { db: parseInt(parsed.pathname.slice(1), 10) } : {}),
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
      ...(process.env.REDIS_FAMILY ? { family: parseInt(process.env.REDIS_FAMILY, 10) } : {}),
    };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    ...(process.env.REDIS_FAMILY ? { family: parseInt(process.env.REDIS_FAMILY, 10) } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  };
}

const connection = buildConnection();

// --- Queues ---

const emailQueue = new Queue("email", { connection });
const reportQueue = new Queue("report", { connection });
const notificationQueue = new Queue("notification", { connection });
const healthCheckQueue = new Queue("health-check", { connection });

// --- Workers ---

new Worker(
  "email",
  async (job) => {
    console.log(`[email] Sending to ${job.data.to}: "${job.data.subject}"`);
    await sleep(random(500, 2000));

    // 10% chance of failure
    if (Math.random() < 0.1) {
      throw new Error("SMTP connection timed out");
    }

    return { delivered: true, ts: Date.now() };
  },
  { connection, concurrency: 3 },
);

new Worker(
  "test",
  async (job) => {
    console.log(`[test] Sending to ${job.data.to}: "${job.data.subject}"`);
    await sleep(random(500, 2000));

    // 10% chance of failure
    if (Math.random() < 0.1) {
      throw new Error("SMTP connection timed out");
    }

    return { delivered: true, ts: Date.now() };
  },
  { connection, concurrency: 3 },
);

new Worker(
  "report",
  async (job) => {
    console.log(`[report] Generating ${job.data.type} report`);
    // Simulate long-running job with progress
    for (let i = 0; i <= 100; i += 20) {
      await job.updateProgress(i);
      await sleep(random(300, 800));
    }
    return { file: `/reports/${job.data.type}-${job.id}.pdf` };
  },
  { connection, concurrency: 1 },
);

new Worker(
  "notification",
  async (job) => {
    console.log(`[notification] Pushing to ${job.data.channel}: "${job.data.message}"`);
    await sleep(random(100, 500));

    if (Math.random() < 0.05) {
      throw new Error("Push service unavailable");
    }
  },
  { connection, concurrency: 5 },
);

new Worker(
  "health-check",
  async (job) => {
    const start = Date.now();
    console.log(`[health-check] Running system health check...`);
    await sleep(random(200, 600));

    const results = {
      database: "ok",
      cache: "ok",
      storage: Math.random() < 0.1 ? "degraded" : "ok",
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };

    console.log(`[health-check] Results: ${JSON.stringify(results)}`);
    return results;
  },
  { connection },
);

console.log("Workers and queues registered. Waiting for jobs...");
