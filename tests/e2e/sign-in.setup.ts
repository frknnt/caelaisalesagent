import { expect, ownerAState, signIn, test } from "./support";

test("sign in once for the harness tests", async ({ page }) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  // Kept out of test-results: the file holds session tokens.
  await page.context().storageState({ path: ownerAState });
});
