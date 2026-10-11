import test from "node:test";
import assert from "node:assert/strict";
import { localPersistence } from "../dist/storage.js";

test("adapter round trips valid household data", () => {
  let value = null;
  const storage = localPersistence(() => ({
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  }));
  assert.deepEqual(storage.load(), []);
  storage.save([{ name: "Rice", needed: true }]);
  assert.deepEqual(storage.load(), [{ name: "Rice", needed: true }]);
});
test("invalid stored inputs are rejected at the storage boundary", () => {
  for (const raw of [
    "broken",
    "{}",
    '[{"name":" ","needed":true}]',
    '[{"name":"Rice","needed":"yes"}]',
    '[{"name":"Rice","needed":false},{"name":"rice","needed":true}]',
  ]) {
    const storage = localPersistence(() => ({
      getItem: () => raw,
      setItem: () => {},
    }));
    assert.throws(() => storage.load());
  }
});
