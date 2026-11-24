import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { test as base, expect, type Page } from "@playwright/test";

import type { Database } from "../../db/database.types";

/** Seed users of supabase/seed.sql. Synthetic, local stack only. */
export const seedPassword = "CaelTest!2026";
export const ownerA = "owner-a@example.test";
export const ownerAState = "tmp/e2e/owner-a.json";
export const tenantAId = "a0000000-0000-4000-8000-000000000001";

const isLocal = (url: string) => {
  const { hostname } = new URL(url);
  return (
    ["127.0.0.1", "localhost"].includes(hostname) ||
    hostname.endsWith(".localhost")
  );
};

/** Every test fails if its page asks for a resource outside this machine. */
export const test = base.extend<{ externalRequests: string[] }>({
  externalRequests: [
    async ({ context }, use) => {
      const requests: string[] = [];
      await context.route(
        (url) => /^https?:$/.test(url.protocol) && !isLocal(url.href),
        (route) => {
          requests.push(new URL(route.request().url()).origin);
          return route.abort();
        },
      );
      await use(requests);
      expect(requests, "requests to external hosts").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function signIn(page: Page, email = ownerA) {
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(seedPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
}

/**
 * Opens the preview and waits until it can be used. The page streams: before
 * React takes over, a field can still be moved and lose focus or input.
 */
export async function openPreview(page: Page) {
  await page.goto("/app/test-harness/preview");
  await expectPreviewReady(page);
}

export async function expectPreviewReady(page: Page) {
  const message = page.getByLabel("Message");
  await expect(message).toBeVisible();
  await expect
    .poll(() =>
      message.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps")),
      ),
    )
    .toBe(true);
}

export async function runTurn(page: Page, scenario: string, message: string) {
  await page.getByLabel("Scripted model behavior").selectOption(scenario);
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

/** Value of one row in the "Last turn" list. */
export function lastTurn(page: Page, term: string) {
  return page
    .getByRole("region", { name: "Last turn" })
    .locator("dl > div")
    .filter({ has: page.getByText(term, { exact: true }) })
    .locator("dd");
}

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map(({ id, nodes }) => [id, nodes[0]?.html])).toEqual([]);
}

/** Service-role reads of what the server stored. Local stack only. */
export function localDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!isLocal(url)) throw new Error("E2E database must be local.");
  return createClient<Database>(url, process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
