import { expect, test } from "@playwright/test";

test("proves a broken browser test fails and leaves evidence", async ({
  page,
}) => {
  await page.setContent("<h1>quality-gate</h1>");
  await expect(page.getByRole("heading")).toHaveText("intentionally-broken", {
    timeout: 500,
  });
});
