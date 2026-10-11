export type StoredItem = Readonly<{ name: string; needed: boolean }>;
export type StorageAccess = Pick<Storage, "getItem" | "setItem">;
const key = "pantry-items-v1";

export function load(storage: StorageAccess): StoredItem[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Invalid saved pantry");
  const names = new Set<string>();
  return parsed.map((value: unknown) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("name" in value) ||
      !("needed" in value) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      typeof value.needed !== "boolean"
    )
      throw new Error("Invalid saved item");
    const name = value.name.trim();
    const identity = name.toLowerCase();
    if (names.has(identity)) throw new Error("Duplicate saved item");
    names.add(identity);
    return { name, needed: value.needed };
  });
}

export function save(
  storage: StorageAccess,
  items: readonly StoredItem[],
): void {
  storage.setItem(key, JSON.stringify(items));
}

export function browserStorage(): StorageAccess {
  return window.localStorage;
}
