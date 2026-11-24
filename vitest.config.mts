import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));
const serverOnlyStub = fileURLToPath(
  new URL("./node_modules/server-only/empty.js", import.meta.url),
);

// `server-only` throws outside a React server build. Next.js resolves the same
// empty module for server code.
const resolve = { alias: { "@": root, "server-only": serverOnlyStub } };

export default defineConfig({
  test: {
    reporters: process.env.CI
      ? ["default", "github-actions", "junit"]
      : ["default", "junit"],
    outputFile: { junit: "test-results/vitest/junit.xml" },
    coverage: {
      reporter: ["text", "html"],
    },
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup/network.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["tests/setup/network.ts", "tests/setup/component.ts"],
        },
      },
    ],
  },
});
