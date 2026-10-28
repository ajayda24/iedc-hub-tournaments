import { defineConfig } from "vitest/config";

// Integration tests start real servers and check-runner threads; give them room when run in parallel.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
