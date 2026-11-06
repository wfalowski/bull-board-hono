import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { queueNameFromKey } from "./discovery.js";

describe("queueNameFromKey", () => {
  it("extracts the queue name from a meta key", () => {
    assert.equal(queueNameFromKey("bull:emails:meta"), "emails");
  });

  it("skips custom-prefix keys, since BullMQ forbids ':' in queue names", () => {
    assert.equal(queueNameFromKey("bull:a:b:meta"), null);
  });

  it("returns null for non-queue keys", () => {
    assert.equal(queueNameFromKey("bull:meta"), null);
    assert.equal(queueNameFromKey("other:x:meta"), null);
    assert.equal(queueNameFromKey("bull:emails:id"), null);
  });
});
