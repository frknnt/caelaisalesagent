import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

import {
  e2eServers,
  readLocalSupabase,
  root,
  serverEnvironment,
} from "./e2e-environment.mjs";

const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
const playwrightArgs = args.filter((arg) => arg !== "--no-build");

function run(script, scriptArgs, env) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const supabase = readLocalSupabase();
rmSync(resolve(root, "test-results/server"), { force: true, recursive: true });

if (!skipBuild) {
  for (const name of Object.keys(e2eServers)) {
    run(resolve(root, "scripts/build.mjs"), [], {
      ...serverEnvironment(name, supabase),
      CAEL_TEST_HARNESS: name === "harness" ? "enabled" : "",
    });
  }
}

run(
  resolve(root, "node_modules/@playwright/test/cli.js"),
  ["test", ...playwrightArgs],
  { ...process.env, ...supabase },
);
