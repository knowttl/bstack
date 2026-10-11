import {
  browserStorage,
  load,
  save,
  type StorageAccess,
  type StoredItem,
} from "./private/storage.js";

export type Item = StoredItem;
export type Pantry = ReturnType<typeof createPantry>;

export function createPantry(provided?: StorageAccess) {
  let items: Item[] = [];
  let saved = false;
  let storage: StorageAccess | undefined = provided;
  try {
    storage ??= browserStorage();
    items = load(storage);
    saved = true;
  } catch {
    saved = false;
  }
  function persist() {
    try {
      storage ??= browserStorage();
      save(storage, items);
      saved = true;
    } catch {
      saved = false;
    }
  }
  return {
    snapshot: () => ({ items: items.map((item) => ({ ...item })), saved }),
    add(name: string) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Enter an item name.");
      if (
        items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())
      )
        return;
      items.push({ name: trimmed, needed: false });
      persist();
    },
    setNeeded(name: string, needed: boolean) {
      const item = items.find((candidate) => candidate.name === name);
      if (!item) throw new Error("Item not found.");
      items = items.map((candidate) =>
        candidate === item ? { ...candidate, needed } : candidate,
      );
      persist();
    },
    retrySave: persist,
  };
}
