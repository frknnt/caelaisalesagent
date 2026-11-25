import { expect, expectAccessible, localDatabase, test } from "../support";
import { knowledgeWorkerTestToken } from "../../../scripts/e2e-environment.mjs";

test.use({ storageState: "tmp/e2e/owner-a.json" });

test.beforeEach(async () => {
  const database = localDatabase();
  await database
    .from("knowledge_sources")
    .delete()
    .eq("organization_id", "a0000000-0000-4000-8000-000000000001");
});

test("source status, duplicate prevention, failure and safe retry are visible", async ({
  page,
}) => {
  await page.goto("/app/knowledge");
  await expect(
    page.getByRole("heading", { name: "Knowledge sources" }),
  ).toBeVisible();
  await expect(page.getByText("No knowledge sources yet.")).toBeVisible();

  const manualForm = page
    .locator("form")
    .filter({ hasText: "Manual text or FAQ" });
  await manualForm.getByLabel("Name").fill("Pricing FAQ");
  await manualForm
    .getByLabel("Content")
    .fill("Email sales@example.test\nPrice 100 TL");
  await manualForm.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByRole("status")).toContainText("queued for ingestion");
  await expect(
    page.getByRole("heading", { name: "Pricing FAQ" }),
  ).toBeVisible();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();

  let processed = false;
  for (let attempt = 0; attempt < 5 && !processed; attempt += 1) {
    const response = await page.request.post("/api/internal/ingestion", {
      headers: { authorization: `Bearer ${knowledgeWorkerTestToken}` },
    });
    expect(response.ok()).toBe(true);
    processed = Boolean((await response.json()).processed);
  }
  expect(processed).toBe(true);
  await page.reload();
  await expect(page.getByText("ready", { exact: true })).toBeVisible();

  const duplicateForm = page
    .locator("form")
    .filter({ hasText: "Manual text or FAQ" });
  await duplicateForm.getByLabel("Name").fill("Pricing FAQ copy");
  await duplicateForm
    .getByLabel("Content")
    .fill("Email sales@example.test\nPrice 100 TL");
  await duplicateForm.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByRole("status")).toContainText("no duplicate job");

  const database = localDatabase();
  const { data: source } = await database
    .from("knowledge_sources")
    .select("id")
    .eq("organization_id", "a0000000-0000-4000-8000-000000000001")
    .single();
  expect(source).toBeTruthy();
  const { data: job } = await database
    .from("ingestion_jobs")
    .select("id")
    .eq("source_id", source?.id ?? "")
    .single();
  await database
    .from("ingestion_jobs")
    .update({ status: "processing", progress: 40 })
    .eq("id", job?.id ?? "");
  await database
    .from("knowledge_sources")
    .update({ status: "processing", progress: 40 })
    .eq("id", source?.id ?? "");

  await page.reload();
  await expect(page.getByText("processing", { exact: true })).toBeVisible();
  await database
    .from("ingestion_jobs")
    .update({ status: "failed", last_error_code: "CORRUPT_DOCUMENT" })
    .eq("id", job?.id ?? "");
  await database
    .from("knowledge_sources")
    .update({ status: "failed", latest_error_code: "CORRUPT_DOCUMENT" })
    .eq("id", source?.id ?? "");
  await page.reload();
  await expect(page.getByText("failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Error: CORRUPT_DOCUMENT")).toBeVisible();
  await page.getByRole("button", { name: "Retry safely" }).click();
  await expect(page.getByRole("status")).toContainText("queued again safely");
  await expect(page.getByText("pending", { exact: true })).toBeVisible();

  await page.goto("/app/knowledge?error=CORRUPT_DOCUMENT");
  await expect(page.getByRole("status")).toContainText("CORRUPT_DOCUMENT");
  await expectAccessible(page);
});

test("knowledge UI is keyboard reachable and does not overflow at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/app/knowledge");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expectAccessible(page);
});
