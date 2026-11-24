import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Started only by scripts/run-paid-tests.mjs. No paid test exists before the
// first provider adapter (P1.3), so a run without tests fails.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/paid/**/*.paid.test.ts"],
  },
});
