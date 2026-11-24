import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  e2eServers,
  readLocalSupabase,
  root,
  serverEnvironment,
} from "./e2e-environment.mjs";

const name = process.argv[2];
if (!Object.hasOwn(e2eServers, name)) {
  throw new Error("Usage: node scripts/e2e-server.mjs harness|standard");
}

// The server log is part of the failure evidence.
const logDirectory = resolve(root, "test-results/server");
mkdirSync(logDirectory, { recursive: true });
const log = createWriteStream(resolve(logDirectory, `${name}.log`));

const preload = pathToFileURL(
  resolve(root, "tests/support/block-egress.mjs"),
).href;
const server = spawn(
  process.execPath,
  [
    "--import",
    preload,
    resolve(root, "node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(e2eServers[name].port),
  ],
  {
    cwd: root,
    env: {
      ...serverEnvironment(name, readLocalSupabase()),
      // Set for both servers: the standard build must stay closed anyway.
      CAEL_TEST_HARNESS: "enabled",
      CAEL_BLOCKED_EGRESS_LOG: resolve(logDirectory, "blocked-egress.log"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
for (const stream of [server.stdout, server.stderr]) {
  stream.pipe(log, { end: false });
  stream.pipe(process.stdout, { end: false });
}
server.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
