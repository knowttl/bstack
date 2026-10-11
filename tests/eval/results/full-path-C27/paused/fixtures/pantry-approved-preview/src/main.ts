import { createPantry } from "./pantry.js";
import { mount } from "./ui/render.js";

const root = document.getElementById("app");
if (!root) throw new Error("Missing app root");
mount(root, createPantry());
