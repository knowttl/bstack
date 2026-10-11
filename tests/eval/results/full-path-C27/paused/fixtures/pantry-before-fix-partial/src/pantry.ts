export interface Item {
  name: string;
  needed: boolean;
}

export interface Persistence {
  load(): Item[];
  save(items: readonly Item[]): void;
}

export class Pantry {
  private items: Item[] = [];
  private saveBlocked = false;
  unsaved = false;
  warning = "";

  constructor(private readonly persistence: Persistence) {
    try {
      this.items = persistence.load();
    } catch {
      this.saveBlocked = true;
      this.unsaved = true;
      this.warning =
        "Saved list could not be read. Changes are unsaved; retry saving only when ready to replace it.";
    }
  }

  list(): Item[] {
    return this.items.map((item) => ({ ...item }));
  }

  shoppingList(): Item[] {
    return this.list().filter((item) => item.needed);
  }

  add(suppliedName: string): void {
    const name = suppliedName.trim();
    if (!name) throw new Error("Enter an item name.");
    if (
      this.items.some((item) => item.name.toLowerCase() === name.toLowerCase())
    )
      return;
    this.items.push({ name, needed: false });
    this.persist();
  }

  setNeeded(name: string, needed: boolean): void {
    const item = this.items.find((item) => item.name === name);
    if (!item) throw new Error("Item was not found.");
    item.needed = needed;
    this.persist();
  }

  retrySave(): void {
    this.saveBlocked = false;
    this.persist();
  }

  private persist(): void {
    this.unsaved = true;
    if (this.saveBlocked) return;
    try {
      this.persistence.save(this.list());
      this.unsaved = false;
      this.warning = "";
    } catch {
      this.warning =
        "Changes are unsaved. Keep using this session and retry saving before reloading.";
    }
  }
}
