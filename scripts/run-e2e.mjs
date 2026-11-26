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

// The suite needs a stack seeded from the current supabase/seed.sql. A stack
// seeded by an older seed (NULL GoTrue token columns, users without a
// password) fails every sign-in test with a misleading 500/400. Fail fast with
// the real reason instead. CI starts a fresh stack; locally, start one with
// `supabase start --workdir <dir>` and pass E2E_SUPABASE_WORKDIR=<dir>.
const seedProbe = await fetch(
  `${supabase.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      apikey: supabase.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "owner-a@example.test",
      password: "CaelTest!2026",
    }),
  },
).catch((error) => ({ ok: false, status: String(error) }));
if (!seedProbe.ok) {
  console.error(
    `E2E preflight: the seed user cannot sign in (status ${seedProbe.status}). ` +
      "This stack was not seeded from the current supabase/seed.sql. Run the " +
      "suite on a fresh stack via E2E_SUPABASE_WORKDIR (see README).",
  );
  process.exit(1);
}

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
