import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Posters come straight from TMDB's CDN at fixed sizes; next/image would add
    // a second resize layer (and server CPU) for no gain.
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-playwright/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees and local Claude Code files (the workflow script is plain JS run by Claude Code).
    ".claude/**",
  ]),
]);

export default eslintConfig;
