import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "./config.js";

const redis = (env: NodeJS.ProcessEnv) => loadConfig(env).redisInstances;

describe("loadConfig redis parsing", () => {
  it("decodes username and percent-encoded password from REDIS_URL", () => {
    const [i] = redis({ REDIS_URL: "redis://user:p%40ss%23word@host:6380/2" });
    assert.equal(i.username, "user");
    assert.equal(i.password, "p@ss#word");
    assert.equal(i.host, "host");
    assert.equal(i.port, 6380);
    assert.equal(i.db, 2);
    assert.equal(i.tls, false);
  });

  it("enables TLS and defaults port 6380 for rediss://", () => {
    const [i] = redis({ REDIS_URL: "rediss://host" });
    assert.equal(i.tls, true);
    assert.equal(i.port, 6380);
  });

  for (const [value, expected] of [
    ["false", false],
    ["true", true],
    ["1", true],
  ] as const) {
    it(`REDIS_TLS=${value} -> tls ${expected}`, () => {
      assert.equal(redis({ REDIS_TLS: value })[0].tls, expected);
    });
  }

  it("keeps a literal % in a REDIS_URL password instead of throwing", () => {
    assert.equal(
      redis({ REDIS_URL: "redis://:pa%ss@host" })[0].password,
      "pa%ss",
    );
  });

  it("accepts numeric tls in REDIS_INSTANCES JSON", () => {
    const [i] = redis({ REDIS_INSTANCES: '[{"name":"a","host":"h","tls":1}]' });
    assert.equal(i.tls, true);
  });

  it("reports an unknown REDIS_TLS value as Invalid configuration", () => {
    assert.throws(
      () => loadConfig({ REDIS_TLS: "maybe" }),
      /Invalid configuration/,
    );
  });

  it("reads REDIS_USERNAME in individual env var mode", () => {
    assert.equal(redis({ REDIS_USERNAME: "u" })[0].username, "u");
  });

  it("accepts boolean tls in REDIS_INSTANCES JSON", () => {
    const [i] = redis({
      REDIS_INSTANCES: '[{"name":"main","host":"r1","tls":true}]',
    });
    assert.equal(i.tls, true);
    assert.equal(i.port, 6379);
  });

  it("throws on invalid REDIS_INSTANCES JSON", () => {
    assert.throws(() => redis({ REDIS_INSTANCES: "[nope" }), /not valid JSON/);
  });

  it("throws on empty REDIS_INSTANCES array", () => {
    assert.throws(() => redis({ REDIS_INSTANCES: "[]" }));
  });

  it("rejects BASE_PATH not starting with /", () => {
    assert.throws(
      () => loadConfig({ BASE_PATH: "admin" }),
      /Invalid configuration/,
    );
  });
});
