import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // Fakes must not reach production code. Test harness routes are compiled
    // only into test builds (see next.config.ts).
    files: ["app/**", "components/**", "lib/**", "*.ts"],
    ignores: ["app/app/test-harness/**", "lib/testing/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/testing/*",
                "**/lib/testing/*",
                "**/test-harness/*",
              ],
              message: "Test fakes are not available to production code.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "docs/evidence/P0.1/screenshots/**",
  ]),
]);
