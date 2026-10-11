import { Pantry } from "./pantry.js";
import { localPersistence } from "./storage.js";
import { mount } from "./ui.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing pantry app root.");
mount(root, new Pantry(localPersistence(() => window.localStorage)));
