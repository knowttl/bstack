import type { Pantry } from "../pantry.js";

export function mount(root: HTMLElement, pantry: Pantry) {
  let shopping = false;
  const title = document.createElement("h1");
  title.textContent = "Pantry list";
  const form = document.createElement("form");
  const label = document.createElement("label");
  label.textContent = "Item name ";
  const input = document.createElement("input");
  input.id = "item-name";
  input.name = "item";
  label.append(input);
  const add = document.createElement("button");
  add.textContent = "Add item";
  form.append(label, add);
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const retry = document.createElement("button");
  retry.textContent = "Retry saving";
  const toggle = document.createElement("button");
  const heading = document.createElement("h2");
  const list = document.createElement("ul");
  list.id = "items";
  function render() {
    const snapshot = pantry.snapshot();
    status.textContent = snapshot.saved
      ? "Saved locally"
      : "Unsaved changes — session only; reload retention is not guaranteed.";
    retry.hidden = snapshot.saved;
    toggle.textContent = shopping ? "View pantry" : "View shopping list";
    heading.textContent = shopping ? "Shopping list" : "Pantry";
    list.replaceChildren();
    for (const item of snapshot.items.filter(
      (item) => !shopping || item.needed,
    )) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = item.name;
      const itemLabel = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.needed;
      checkbox.setAttribute("aria-label", `Need to buy ${item.name}`);
      checkbox.addEventListener("change", () => {
        pantry.setNeeded(item.name, checkbox.checked);
        render();
      });
      itemLabel.append(checkbox, " Needed");
      row.append(name, " ", itemLabel);
      list.append(row);
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      pantry.add(input.value);
      input.value = "";
      error.textContent = "";
      render();
    } catch (failure) {
      error.textContent =
        failure instanceof Error ? failure.message : "Could not add item.";
    }
  });
  toggle.addEventListener("click", () => {
    shopping = !shopping;
    render();
  });
  retry.addEventListener("click", () => {
    pantry.retrySave();
    render();
  });
  root.replaceChildren(
    title,
    form,
    error,
    status,
    retry,
    toggle,
    heading,
    list,
  );
  render();
}
