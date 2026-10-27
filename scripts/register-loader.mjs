// Registers the resolver in loader-hooks.mjs. Loaded with `node --import` before a script runs.
import { register } from "node:module";

register("./loader-hooks.mjs", import.meta.url);
