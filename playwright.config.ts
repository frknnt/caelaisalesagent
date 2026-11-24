import { defineConfig } from "@playwright/test";

import { e2eServers, hostPort, serverUrl } from "./scripts/e2e-environment.mjs";

const isCI = Boolean(process.env.CI);

const server = (name: keyof typeof e2eServers) => ({
  command: `node scripts/e2e-server.mjs ${name}`,
  url: `${serverUrl(name)}/api/health`,
  reuseExistingServer: false,
  timeout: 60_000,
});

// Run with `npm run test:e2e`, which builds both servers first.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  forbidOnly: isCI,
  // A flaky test is a failed test. Retries would hide it.
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/e2e-junit.xml" }],
    ["html", { open: "never" }],
  ],
  use: {
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    server("harness"),
    server("standard"),
    {
      command: "node tests/support/widget-host.mjs",
      url: `http://127.0.0.1:${hostPort}/health`,
      reuseExistingServer: false,
      timeout: 15_000,
    },
  ],
  projects: [
    {
      name: "sign-in",
      testMatch: "sign-in.setup.ts",
      use: { baseURL: serverUrl("harness") },
    },
    {
      name: "harness",
      testMatch: "harness/*.spec.ts",
      dependencies: ["sign-in"],
      use: { baseURL: serverUrl("harness") },
    },
    {
      name: "standard-build",
      testMatch: "standard/*.spec.ts",
      use: { baseURL: serverUrl("standard") },
    },
    {
      name: "widget",
      testMatch: "widget/*.spec.ts",
      use: { baseURL: serverUrl("standard") },
    },
  ],
});
