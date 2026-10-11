import test from "node:test";
import assert from "node:assert/strict";
import { Pantry } from "../dist/pantry.js";

function memory() {
  let saved = [];
  return {
    load: () => structuredClone(saved),
    save: (items) => {
      saved = structuredClone(items);
    },
  };
}
test("Rice purchase intention survives saving and reloading", () => {
  const storage = memory();
  const pantry = new Pantry(storage);
  pantry.add("Rice");
  pantry.setNeeded("Rice", true);
  assert.deepEqual(pantry.shoppingList(), [{ name: "Rice", needed: true }]);
  assert.deepEqual(new Pantry(storage).shoppingList(), pantry.shoppingList());
});
test("duplicate names reuse needed item; full names distinguish variants", () => {
  const pantry = new Pantry(memory());
  pantry.add("Rice");
  pantry.setNeeded("Rice", true);
  pantry.add(" rice ");
  pantry.add("Brown Rice");
  pantry.add("White Rice");
  assert.deepEqual(pantry.list(), [
    { name: "Rice", needed: true },
    { name: "Brown Rice", needed: false },
    { name: "White Rice", needed: false },
  ]);
  assert.throws(() => pantry.add("  "), /Enter an item name/);
  pantry.setNeeded("Rice", false);
  assert.deepEqual(pantry.shoppingList(), []);
});
test("failed saves keep current edits and retry saves the latest session", () => {
  const storage = memory();
  let failing = true;
  const pantry = new Pantry({
    load: storage.load,
    save: (items) => {
      if (failing) throw new Error("blocked");
      storage.save(items);
    },
  });
  pantry.add("Rice");
  pantry.setNeeded("Rice", true);
  pantry.add("Beans");
  assert.equal(pantry.unsaved, true);
  assert.match(pantry.warning, /unsaved/);
  assert.deepEqual(new Pantry(storage).list(), []);
  pantry.retrySave();
  assert.equal(pantry.unsaved, true);
  failing = false;
  pantry.retrySave();
  assert.equal(pantry.unsaved, false);
  assert.deepEqual(new Pantry(storage).list(), pantry.list());
});
test("unreadable saved data is not silently overwritten", () => {
  let saves = 0;
  const pantry = new Pantry({
    load: () => {
      throw new Error("invalid");
    },
    save: () => {
      saves++;
    },
  });
  pantry.add("Rice");
  assert.equal(saves, 0);
  assert.equal(pantry.unsaved, true);
  pantry.retrySave();
  assert.equal(saves, 1);
  assert.equal(pantry.unsaved, false);
});
