import { defineConfig } from "@playwright/test";

/** Only for scripts/prove-ci-failure.mjs. Same evidence settings as the suite. */
export default defineConfig({
  testDir: "tests/fixtures",
  testMatch: "intentional-failure.e2e.ts",
  outputDir: "test-results/failure-proof/e2e",
  retries: 0,
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/failure-proof/e2e-junit.xml" }],
  ],
  use: {
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
