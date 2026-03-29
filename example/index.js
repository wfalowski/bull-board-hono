import { Queue, Worker } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

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

// --- Cron: repeatable job running every 30 seconds ---

await healthCheckQueue.upsertJobScheduler(
  "system-health",
  { every: 30_000 },
  {
    name: "check",
    data: { source: "scheduler" },
  },
);
console.log("Cron registered: health-check runs every 30s\n");

// --- Producers: enqueue jobs on a loop ---

const recipients = ["alice@example.com", "bob@example.com", "charlie@example.com"];
const subjects = ["Welcome!", "Your invoice", "Password reset", "Weekly digest"];
const reportTypes = ["sales", "usage", "performance", "audit"];
const channels = ["slack", "push", "sms", "in-app"];

async function produce() {
  console.log("Producer started — adding jobs every few seconds...\n");

  while (true) {
    // Add 1-3 email jobs
    const emailCount = random(1, 3);
    for (let i = 0; i < emailCount; i++) {
      await emailQueue.add("send", {
        to: pick(recipients),
        subject: pick(subjects),
        body: "Lorem ipsum dolor sit amet.",
      }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      });
    }

    // Add a report job occasionally
    if (Math.random() < 0.3) {
      await reportQueue.add("generate", {
        type: pick(reportTypes),
        requestedBy: pick(recipients),
      }, {
        attempts: 2,
      });
    }

    // Add 2-5 notification jobs
    const notifCount = random(2, 5);
    for (let i = 0; i < notifCount; i++) {
      await notificationQueue.add("push", {
        channel: pick(channels),
        message: `Event #${random(1000, 9999)} occurred`,
        userId: `user-${random(1, 50)}`,
      });
    }

    // Add a delayed notification
    if (Math.random() < 0.2) {
      await notificationQueue.add("push", {
        channel: "push",
        message: "Scheduled reminder",
        userId: `user-${random(1, 50)}`,
      }, {
        delay: random(5000, 15000),
      });
    }

    await sleep(random(2000, 5000));
  }
}

produce().catch((err) => {
  console.error("Producer error:", err);
  process.exit(1);
});

// --- Helpers ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
