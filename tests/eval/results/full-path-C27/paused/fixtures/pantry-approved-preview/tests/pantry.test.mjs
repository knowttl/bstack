import test from "node:test";
import assert from "node:assert/strict";
import { createPantry } from "../dist/pantry-test.mjs";

function memory() {
  let value = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}
test("Rice journey persists the needed mark and duplicate identity", () => {
  const storage = memory();
  const pantry = createPantry(storage);
  pantry.add("Rice");
  pantry.setNeeded("Rice", true);
  pantry.add(" rice ");
  pantry.add("Brown Rice");
  pantry.add("White Rice");
  const reloaded = createPantry(storage).snapshot();
  assert.deepEqual(reloaded.items, [
    { name: "Rice", needed: true },
    { name: "Brown Rice", needed: false },
    { name: "White Rice", needed: false },
  ]);
  assert.equal(reloaded.saved, true);
});
test("empty names fail and snapshots cannot change pantry state", () => {
  const pantry = createPantry(memory());
  assert.throws(() => pantry.add("  "), /Enter an item name/);
  pantry.add("Rice");
  pantry.snapshot().items[0].needed = true;
  assert.equal(pantry.snapshot().items[0].needed, false);
});
test("storage failure keeps work usable; retry saves it", () => {
  const storage = memory();
  let fail = true;
  const pantry = createPantry({
    getItem: storage.getItem,
    setItem: (...args) => {
      if (fail) throw new Error("Full");
      storage.setItem(...args);
    },
  });
  pantry.add("Rice");
  pantry.setNeeded("Rice", true);
  assert.equal(pantry.snapshot().saved, false);
  assert.equal(pantry.snapshot().items[0].needed, true);
  fail = false;
  pantry.retrySave();
  assert.equal(pantry.snapshot().saved, true);
  assert.equal(createPantry(storage).snapshot().items[0].needed, true);
});
test("invalid stored input stays visibly unsaved", () => {
  const pantry = createPantry({
    getItem: () => '[{"name":"Rice","needed":"yes"}]',
    setItem: () => {},
  });
  assert.equal(pantry.snapshot().saved, false);
  assert.deepEqual(pantry.snapshot().items, []);
});
