import { defineConfig, devices } from "@playwright/test";

// End-to-end: a real arena (port 4100, throwaway data dir) serving the built web app.
// Build first: `pnpm build`, then `pnpm test:e2e`.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4100",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"], launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined } }],
  webServer: {
    command: "node apps/arena/node_modules/tsx/dist/cli.mjs apps/arena/src/index.ts --port 4100 --pin 2468 --fresh --data .e2e-data",
    url: "http://localhost:4100/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
