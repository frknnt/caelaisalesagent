import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const root = process.cwd();
const cli = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
const args = [cli, "gen", "types", "typescript", "--schema", "public"];

const generated = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, DO_NOT_TRACK: "1" },
  shell: false,
});

if (generated.error) {
  process.stderr.write(`${generated.error.message}\n`);
  process.exit(1);
}

if (generated.status !== 0) {
  process.stderr.write(
    generated.stderr || generated.stdout || "Type generation failed.\n",
  );
  process.exit(generated.status ?? 1);
}

const typesPath = path.join(root, "db", "database.types.ts");
const [expectedFormatted, currentFormatted] = await Promise.all([
  format(generated.stdout, { parser: "typescript" }),
  format(await readFile(typesPath, "utf8"), { parser: "typescript" }),
]);

const canonicalize = (source) =>
  source.replace(/\s+/g, "").replace(/[\"';]/g, "");
const expected = canonicalize(expectedFormatted);
const current = canonicalize(currentFormatted);

if (expected !== current) {
  const mismatch = Array.from({
    length: Math.min(expected.length, current.length),
  }).findIndex((_, index) => expected[index] !== current[index]);
  const start = Math.max(0, mismatch - 80);
  const end = Math.max(mismatch + 160, start + 160);
  process.stderr.write(
    [
      "db/database.types.ts is stale. Run `npm run db:types` against the local stack.",
      `First mismatch at canonical offset ${mismatch}.`,
      `Expected: ${expected.slice(start, end)}`,
      `Current:  ${current.slice(start, end)}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

process.stdout.write("Database types match the local public schema.\n");
