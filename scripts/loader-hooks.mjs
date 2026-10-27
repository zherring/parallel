// Lets Node's native TypeScript support run code under src/ unchanged. The app imports with the
// `@/` alias and without file extensions (resolved by the bundler); Node needs real paths. This
// maps `@/x` to `src/x` and tries `.ts` for extensionless paths, so scripts can reuse the exact
// modules the pages use instead of keeping a copy. Pair it with `--conditions=react-server` so
// `import "server-only"` resolves to its empty module.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

const isFile = (url) => {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
};

function withTsExtension(url) {
  if (isFile(url)) return url;
  const ts = new URL(`${url.href}.ts`);
  if (existsSync(ts)) return ts;
  return url;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = withTsExtension(new URL(specifier.slice(2), SRC));
    return nextResolve(url.href, context);
  }
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && context.parentURL) {
    const url = withTsExtension(new URL(specifier, context.parentURL));
    return nextResolve(url.href, context);
  }
  return nextResolve(specifier, context);
}
