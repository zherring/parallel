import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3102",
    viewport: { width: 1440, height: 600 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    // Opt-in, so the default run is no slower and needs no extra browser: `WEBKIT=1 npx playwright test --project=webkit` runs the Depth
    // view's spec in Safari's engine (`npx playwright install webkit` first). Perspective inside a scroller has been unreliable there.
    ...(process.env.WEBKIT ? [{ name: "webkit", testMatch: "**/depth-view.spec.ts", use: { browserName: "webkit" as const } }] : []),
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    env: { PLAYWRIGHT_TEST: "1", TMDB_READ_ACCESS_TOKEN: "browser-test-placeholder" },
    timeout: 120_000,
  },
});
