import type { Item, Persistence } from "./pantry.js";

export const storageKey = "pantry-list-v1";

export function localPersistence(
  getStorage: () => Pick<Storage, "getItem" | "setItem">,
): Persistence {
  return {
    load() {
      const raw = getStorage().getItem(storageKey);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Invalid pantry data.");
      const names = new Set<string>();
      return parsed.map((entry: unknown) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          !("name" in entry) ||
          !("needed" in entry) ||
          typeof entry.name !== "string" ||
          !entry.name.trim() ||
          entry.name !== entry.name.trim() ||
          typeof entry.needed !== "boolean"
        )
          throw new Error("Invalid pantry item.");
        const key = entry.name.toLowerCase();
        if (names.has(key)) throw new Error("Duplicate pantry item.");
        names.add(key);
        return { name: entry.name, needed: entry.needed };
      });
    },
    save(items: readonly Item[]) {
      getStorage().setItem(storageKey, JSON.stringify(items));
    },
  };
}
