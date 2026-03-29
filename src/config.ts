import { z } from "zod";

const RedisInstanceSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1).default("localhost"),
  port: z.coerce.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.coerce.number().int().min(0).max(15).optional(),
  tls: z.coerce.boolean().optional(),
  family: z.coerce
    .number()
    .int()
    .refine((v) => v === 0 || v === 4 || v === 6, {
      message: "family must be 0 (auto), 4 (IPv4), or 6 (IPv6)",
    })
    .optional(),
});

export type RedisInstance = z.infer<typeof RedisInstanceSchema>;

export type Config = z.infer<typeof ConfigSchema>;

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  authUsername: z.string().trim().min(1).optional(),
  authPassword: z.string().trim().min(1).optional(),
  redisInstances: z.array(RedisInstanceSchema).min(1),
  queueDiscoveryInterval: z.coerce.number().int().min(1000),
  basePath: z.string().startsWith("/"),
});

/**
 * Parse a Redis URL into a RedisInstance.
 * Supports: redis[s]://[[username:]password@]host[:port][/db]
 */
function parseRedisUrl(url: string, name: string): RedisInstance {
  const parsed = new URL(url);
  const tls = parsed.protocol === "rediss:";
  const db =
    parsed.pathname.length > 1
      ? Number.parseInt(parsed.pathname.slice(1), 10)
      : undefined;

  return RedisInstanceSchema.parse({
    name,
    host: parsed.hostname || "localhost",
    port: parsed.port || (tls ? "6380" : "6379"),
    password: parsed.password || undefined,
    db,
    tls,
    family: process.env.REDIS_FAMILY || undefined,
  });
}

/**
 * Parse Redis instances from environment variables.
 *
 * Supports three modes (checked in order):
 *
 * 1. Multiple Redis instances via REDIS_INSTANCES JSON:
 *    REDIS_INSTANCES='[{"name":"main","host":"redis-1","port":6379}]'
 *
 * 2. Redis URL (single instance):
 *    REDIS_URL='redis://:password@redis-host:6379/0'
 *    REDIS_URL='rediss://redis-host:6380'  (TLS)
 *
 * 3. Individual env vars (default):
 *    REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, REDIS_TLS
 */
function parseRedisInstances(): RedisInstance[] {
  const instancesJson = process.env.REDIS_INSTANCES;

  if (instancesJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(instancesJson);
    } catch {
      throw new Error(
        "REDIS_INSTANCES is not valid JSON. Expected a JSON array of objects, e.g.: " +
          '[{"name":"main","host":"redis-1","port":6379}]',
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("REDIS_INSTANCES must be a JSON array");
    }

    return z.array(RedisInstanceSchema).min(1).parse(parsed);
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return [parseRedisUrl(redisUrl, process.env.REDIS_NAME || "default")];
  }

  return [
    RedisInstanceSchema.parse({
      name: process.env.REDIS_NAME || "default",
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || "6379",
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || undefined,
      tls: process.env.REDIS_TLS || undefined,
      family: process.env.REDIS_FAMILY || undefined,
    }),
  ];
}

export function loadConfig(): Config {
  const redisInstances = parseRedisInstances();

  try {
    return ConfigSchema.parse({
      port: process.env.PORT || "3000",
      authUsername: process.env.AUTH_USERNAME || undefined,
      authPassword: process.env.AUTH_PASSWORD || undefined,
      redisInstances,
      queueDiscoveryInterval: process.env.QUEUE_DISCOVERY_INTERVAL || "10000",
      basePath: process.env.BASE_PATH || "/",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map(
        (i) => `  ${i.path.join(".")}: ${i.message}`,
      );
      throw new Error(`Invalid configuration:\n${messages.join("\n")}`, {
        cause: err,
      });
    }
    throw err;
  }
}
