import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Paid provider calls need two deliberate steps by a person, and never run in
// CI. Nothing else in this repository starts them.
const CONFIRMATION_FLAG = "--confirm-paid-calls";
const APPROVAL = "I approve paid API calls";

const problems = [
  process.env.CI && "Paid tests never run in CI.",
  !process.argv.includes(CONFIRMATION_FLAG) &&
    `Pass ${CONFIRMATION_FLAG} after "--".`,
  process.env.CAEL_PAID_API_TESTS !== APPROVAL &&
    `Set CAEL_PAID_API_TESTS to "${APPROVAL}".`,
].filter(Boolean);

if (problems.length > 0) {
  console.error(["REFUSED: no paid call was made.", ...problems].join("\n"));
  process.exit(2);
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const result = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    resolve(root, "vitest.paid.config.mts"),
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
