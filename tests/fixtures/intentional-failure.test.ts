import { expect, it } from "vitest";

it("proves the test runner returns non-zero for a broken expectation", () => {
  expect("quality-gate").toBe("intentionally-broken");
});
