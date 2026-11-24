import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Runs tests that must fail, and checks both the exit code and the evidence a
// failed run leaves behind. `npm run test:failure-proof -- --e2e` adds Chrome.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evidence = resolve(root, "test-results/failure-proof");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function proveFailure(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, CI_FAILURE_PROBE: "1" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status === 0) {
    fail(`The intentionally broken ${label} test unexpectedly passed.`);
  }
  console.log(
    `PASS: The intentionally broken ${label} test returned exit code ${result.status}.`,
  );
}

function proveReport(name) {
  const path = resolve(evidence, name);
  if (
    !existsSync(path) ||
    !/<failure[\s\S]*intentionally-broken/.test(readFileSync(path, "utf8"))
  ) {
    fail(`${name} does not describe the failure.`);
  }
  console.log(`PASS: ${name} describes the failure.`);
}

rmSync(evidence, { force: true, recursive: true });

proveFailure("unit", [
  resolve(root, "node_modules/vitest/vitest.mjs"),
  "run",
  "--config",
  resolve(root, "vitest.failure.config.mts"),
]);
proveReport("vitest-junit.xml");

if (process.argv.includes("--e2e")) {
  proveFailure("browser", [
    resolve(root, "node_modules/@playwright/test/cli.js"),
    "test",
    "--config",
    resolve(root, "playwright.failure.config.ts"),
  ]);
  proveReport("e2e-junit.xml");
  const files = readdirSync(resolve(evidence, "e2e"), {
    encoding: "utf8",
    recursive: true,
  });
  for (const extension of ["trace.zip", ".png"]) {
    if (!files.some((file) => file.endsWith(extension))) {
      fail(`The browser failure left no ${extension} file.`);
    }
    console.log(`PASS: The browser failure left a ${extension} file.`);
  }
}
