import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanNextDirectory } from "./clean-next.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = process.env.CAEL_NEXT_DIST_DIR || ".next";

// Next.js points these files at its build directory. An isolated build puts
// them back, so type checks and a running dev server keep using `.next`.
const generated =
  distDir === ".next" ? [] : ["next-env.d.ts", "tsconfig.isolated.json"];
const snapshots = generated
  .map((name) => resolve(root, name))
  .filter(existsSync)
  .map((path) => [path, readFileSync(path)]);

cleanNextDirectory(distDir);
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
  { cwd: root, env: process.env, stdio: "inherit" },
);
for (const [path, content] of snapshots) writeFileSync(path, content);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
