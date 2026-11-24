import {
  expect,
  expectPreviewReady,
  lastTurn,
  runTurn,
  signIn,
  test,
} from "../support";

test.describe("smoke", () => {
  test("login -> agent -> preview", async ({ page }) => {
    await page.goto("/app/test-harness");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftest-harness$/);
    await signIn(page);

    await expect(page).toHaveURL(/\/app\/test-harness$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Test agent" }),
    ).toBeVisible();
    await expect(page.getByText("Tenant A Internal")).toBeVisible();
    await expect(page.getByText("Says it is an AI agent")).toBeVisible();
    await page.getByRole("link", { name: "Open Preview" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Test preview" }),
    ).toBeVisible();
    const conversation = page.getByRole("log", { name: "Conversation" });
    await expect(conversation).toContainText("an AI agent");
    await expect(conversation).toContainText("No messages yet.");

    await expectPreviewReady(page);
    await runTurn(page, "answer", "What do you sell?");
    await expect(page.getByRole("status")).toHaveText("The agent is writing…");
    await expect(conversation).toContainText("This is a scripted answer.");
    await expect(conversation).toContainText("Fixture source");
    await expect(lastTurn(page, "Outcome")).toHaveText("completed");
    await expect(lastTurn(page, "Webhook deliveries")).toHaveText("1");

    await page.getByRole("button", { name: "Talk to a Person" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "A person has the conversation. The AI agent will not reply.",
    );
    await expect(page.getByLabel("Message")).toBeDisabled();
  });

  test("a wrong password stays on the login page with a safe message", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("owner-a@example.test");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("alert").first()).toContainText(
      "That email and password do not match.",
    );
    await page.goto("/app/test-harness/preview");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("a signed-in user without a workspace cannot open the harness", async ({
    page,
  }) => {
    await page.goto("/login");
    await signIn(page, "outsider@example.test");
    await expect(page).toHaveURL(/\/app$/);
    const response = await page.goto("/app/test-harness");
    expect(response?.status()).toBe(404);
  });
});
