import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import type { RedisInstance } from "./config.js";
import { logger } from "./logger.js";

export interface DiscoveredQueue {
  key: string;
  instanceName: string;
  queueName: string;
  queue: Queue;
}

interface InstanceState {
  redis: IORedis;
  instance: RedisInstance;
  knownQueues: Map<string, DiscoveredQueue>;
}

const SCAN_BATCH_SIZE = 100;

export class QueueDiscovery {
  private states: InstanceState[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private instances: RedisInstance[]) {}

  async start(
    intervalMs: number,
    onChange: (queues: DiscoveredQueue[]) => void,
  ): Promise<DiscoveredQueue[]> {
    this.running = true;

    this.states = this.instances.map((instance) => {
      const redis = new IORedis({
        host: instance.host,
        port: instance.port,
        password: instance.password,
        db: instance.db,
        tls: instance.tls ? {} : undefined,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy(times) {
          return Math.min(times * 500, 30_000);
        },
      });

      const state: InstanceState = {
        redis,
        instance,
        knownQueues: new Map(),
      };

      redis.on("error", (err: Error) => {
        logger.error(`[${instance.name}] Redis error: ${err.message}`);
      });

      redis.on("close", () => {
        logger.warn(
          `[${instance.name}] Redis connection closed, clearing queues`,
        );
        for (const dq of state.knownQueues.values()) {
          dq.queue.close().catch(() => {});
        }
        state.knownQueues.clear();
      });

      redis.on("reconnecting", () => {
        logger.info(`[${instance.name}] Reconnecting to Redis...`);
      });

      return state;
    });

    await Promise.all(
      this.states.map((s) =>
        s.redis.connect().catch((err: Error) => {
          logger.error(
            `Failed to connect to Redis "${s.instance.name}" at ${s.instance.host}:${s.instance.port}: ${err.message}`,
          );
        }),
      ),
    );

    // Initial discovery — always notify
    const initial = await this.discover();
    onChange(initial.queues);

    // Schedule periodic re-discovery
    this.scheduleNext(intervalMs, onChange);

    return initial.queues;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);

    const closePromises: Promise<void>[] = [];
    for (const state of this.states) {
      for (const dq of state.knownQueues.values()) {
        closePromises.push(dq.queue.close());
      }
    }
    await Promise.all(closePromises);

    for (const state of this.states) {
      state.redis.disconnect();
    }
  }

  getConnectionStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();
    for (const s of this.states) {
      status.set(s.instance.name, s.redis.status === "ready");
    }
    return status;
  }

  private scheduleNext(
    intervalMs: number,
    onChange: (queues: DiscoveredQueue[]) => void,
  ): void {
    this.timer = setTimeout(async () => {
      if (!this.running) return;
      try {
        const result = await this.discover();
        if (result.changed) {
          onChange(result.queues);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Discovery tick error: ${message}`);
      }
      if (this.running) {
        this.scheduleNext(intervalMs, onChange);
      }
    }, intervalMs);
  }

  private async discover(): Promise<{
    queues: DiscoveredQueue[];
    changed: boolean;
  }> {
    let changed = false;

    for (const state of this.states) {
      if (state.redis.status !== "ready") continue;

      try {
        const queueNames = await this.scanForQueues(state.redis);
        const currentNames = new Set(queueNames);

        // Remove queues that no longer exist
        for (const [key, dq] of state.knownQueues) {
          if (!currentNames.has(dq.queueName)) {
            await dq.queue.close();
            state.knownQueues.delete(key);
            logger.info(
              `[${state.instance.name}] Removed queue: ${dq.queueName}`,
            );
            changed = true;
          }
        }

        // Add newly discovered queues
        for (const name of queueNames) {
          const key = `${state.instance.name}:${name}`;
          if (!state.knownQueues.has(key)) {
            const queue = new Queue(name, {
              connection: {
                host: state.instance.host,
                port: state.instance.port,
                password: state.instance.password,
                db: state.instance.db,
                tls: state.instance.tls ? {} : undefined,
                maxRetriesPerRequest: null,
              },
            });
            state.knownQueues.set(key, {
              key,
              instanceName: state.instance.name,
              queueName: name,
              queue,
            });
            logger.info(`[${state.instance.name}] Discovered queue: ${name}`);
            changed = true;
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[${state.instance.name}] Discovery error: ${message}`);
      }
    }

    return {
      queues: this.states.flatMap((s) => [...s.knownQueues.values()]),
      changed,
    };
  }

  /**
   * Scan Redis for BullMQ queue keys.
   * BullMQ stores keys as `bull:<queueName>:meta`.
   */
  private async scanForQueues(redis: IORedis): Promise<string[]> {
    const pattern = "bull:*:meta";
    const queueNames = new Set<string>();
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const parts = key.split(":");
        if (parts.length >= 3 && parts[0] === "bull") {
          const queueName = parts.slice(1, -1).join(":");
          queueNames.add(queueName);
        }
      }
    } while (cursor !== "0");

    return [...queueNames];
  }
}
