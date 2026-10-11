import type { Pantry } from "./pantry.js";

export function mount(root: HTMLElement, pantry: Pantry): void {
  let view = "pantry";
  root.innerHTML = `<h1>Pantry list</h1>
    <p>Keep track of supplies and what you need to buy.</p>
    <form><label for="item-name">Item name</label>
      <input id="item-name" name="name" autocomplete="off" required />
      <button type="submit">Add item</button></form>
    <p id="input-error" role="alert"></p>
    <nav aria-label="Lists"><button id="pantry-view">Pantry</button>
      <button id="shopping-view">Shopping list</button></nav>
    <h2 id="view-title"></h2><ul id="items"></ul>
    <p id="save-status" role="status"></p><button id="retry-save">Retry saving</button>`;
  const form = root.querySelector<HTMLFormElement>("form")!;
  const input = root.querySelector<HTMLInputElement>("#item-name")!;
  const error = root.querySelector<HTMLElement>("#input-error")!;
  const items = root.querySelector<HTMLUListElement>("#items")!;
  const status = root.querySelector<HTMLElement>("#save-status")!;
  const retry = root.querySelector<HTMLButtonElement>("#retry-save")!;
  function render(): void {
    root.querySelector<HTMLElement>("#view-title")!.textContent =
      view === "pantry" ? "Pantry" : "Shopping list";
    root
      .querySelector<HTMLButtonElement>("#pantry-view")!
      .setAttribute("aria-pressed", String(view === "pantry"));
    root
      .querySelector<HTMLButtonElement>("#shopping-view")!
      .setAttribute("aria-pressed", String(view === "shopping"));
    items.replaceChildren();
    const list = view === "pantry" ? pantry.list() : pantry.shoppingList();
    if (list.length === 0) {
      const empty = document.createElement("li");
      empty.textContent =
        view === "pantry" ? "No items yet." : "Nothing marked needed.";
      items.append(empty);
    }
    for (const item of list) {
      const row = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.needed;
      checkbox.setAttribute("aria-label", `Need ${item.name}`);
      checkbox.addEventListener("change", () => {
        pantry.setNeeded(item.name, checkbox.checked);
        render();
      });
      label.append(checkbox, document.createTextNode(` ${item.name}`));
      row.append(label);
      items.append(row);
    }
    status.textContent = pantry.unsaved ? pantry.warning : "Saved locally.";
    retry.hidden = !pantry.unsaved;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      pantry.add(input.value);
      input.value = "";
      error.textContent = "";
      render();
    } catch (cause) {
      error.textContent =
        cause instanceof Error ? cause.message : "Could not add item.";
    }
  });
  root.querySelector("#pantry-view")!.addEventListener("click", () => {
    view = "pantry";
    render();
  });
  root.querySelector("#shopping-view")!.addEventListener("click", () => {
    view = "shopping";
    render();
  });
  retry.addEventListener("click", () => {
    pantry.retrySave();
    render();
  });
  render();
}
