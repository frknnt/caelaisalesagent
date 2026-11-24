import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/fixtures/intentional-failure.test.ts"],
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/failure-proof/vitest-junit.xml" },
  },
});
