import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const approval = "I approve paid API calls";

function runPaid(args: string[], env: Record<string, string>) {
  const base = { ...process.env };
  delete base.CI;
  delete base.CAEL_PAID_API_TESTS;
  return spawnSync(process.execPath, ["scripts/run-paid-tests.mjs", ...args], {
    encoding: "utf8",
    env: { ...base, ...env },
  });
}

describe("paid API tests", () => {
  it.each<[string, string[], Record<string, string>]>([
    ["no approval", [], {}],
    ["flag only", ["--confirm-paid-calls"], {}],
    ["variable only", [], { CAEL_PAID_API_TESTS: approval }],
    [
      "wrong variable",
      ["--confirm-paid-calls"],
      { CAEL_PAID_API_TESTS: "true" },
    ],
    [
      "full approval in CI",
      ["--confirm-paid-calls"],
      { CAEL_PAID_API_TESTS: approval, CI: "true" },
    ],
  ])("are refused: %s", (_name, args, env) => {
    const result = runPaid(args, env);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("REFUSED: no paid call was made.");
  });

  it("are not started by any other script or by CI", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const callers = Object.entries(scripts)
      .filter(([, command]) => /paid/.test(command))
      .map(([name]) => name);
    expect(callers).toEqual(["test:paid"]);
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).not.toMatch(
      /paid/i,
    );
  });
});
