import { z } from "zod";

const RedisInstanceSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1).default("localhost"),
  port: z.coerce.number().int().min(1).max(65535).default(6379),
  username: z.string().optional(),
  password: z.string().optional(),
  db: z.coerce.number().int().min(0).max(15).optional(),
  // Real boolean or number from REDIS_INSTANCES JSON, or an env string ("false" must stay false)
  tls: z
    .union([z.boolean(), z.number().transform(Boolean), z.stringbool()])
    .optional(),
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

/** Percent-decode URL userinfo; a literal "%" (as `new URL` leaves it) is kept as-is. */
function decodeUserinfo(value: string): string | undefined {
  try {
    return decodeURIComponent(value) || undefined;
  } catch {
    return value || undefined;
  }
}

/**
 * Parse a Redis URL into a RedisInstance.
 * Supports: redis[s]://[[username:]password@]host[:port][/db]
 * Username and password are percent-decoded.
 */
function parseRedisUrl(
  url: string,
  name: string,
  env: NodeJS.ProcessEnv,
): RedisInstance {
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
    username: decodeUserinfo(parsed.username),
    password: decodeUserinfo(parsed.password),
    db,
    tls,
    family: env.REDIS_FAMILY || undefined,
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
 *    REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_DB, REDIS_TLS
 */
function parseRedisInstances(
  env: NodeJS.ProcessEnv = process.env,
): RedisInstance[] {
  const instancesJson = env.REDIS_INSTANCES;

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

  const redisUrl = env.REDIS_URL;
  if (redisUrl) {
    return [parseRedisUrl(redisUrl, env.REDIS_NAME || "default", env)];
  }

  return [
    RedisInstanceSchema.parse({
      name: env.REDIS_NAME || "default",
      host: env.REDIS_HOST || "localhost",
      port: env.REDIS_PORT || "6379",
      username: env.REDIS_USERNAME || undefined,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB || undefined,
      tls: env.REDIS_TLS || undefined,
      family: env.REDIS_FAMILY || undefined,
    }),
  ];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    const redisInstances = parseRedisInstances(env);
    return ConfigSchema.parse({
      port: env.PORT || "3000",
      authUsername: env.AUTH_USERNAME || undefined,
      authPassword: env.AUTH_PASSWORD || undefined,
      redisInstances,
      queueDiscoveryInterval: env.QUEUE_DISCOVERY_INTERVAL || "10000",
      basePath: env.BASE_PATH || "/",
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
