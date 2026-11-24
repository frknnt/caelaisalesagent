import type { Page } from "@playwright/test";

import {
  expect,
  expectAccessible,
  lastTurn,
  openPreview,
  ownerAState,
  runTurn,
  test,
} from "../support";

test.use({ storageState: ownerAState });

const widths = [320, 375, 768, 1024, 1440];

/** Horizontal overflow, small text and small targets in the main content. */
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const main = document.querySelector("main") ?? document.body;
    const visible = [...main.querySelectorAll<HTMLElement>("*")].filter(
      (element) => element.getClientRects().length > 0,
    );
    const ownText = (element: HTMLElement) =>
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
    return {
      overflow: root.scrollWidth - root.clientWidth,
      smallText: visible
        .filter(
          (element) =>
            ownText(element) &&
            Number.parseFloat(getComputedStyle(element).fontSize) < 14,
        )
        .map((element) => element.textContent),
      smallTargets: visible
        .filter((element) => element.matches("a, button, select, textarea"))
        .filter((element) => element.getBoundingClientRect().height < 44)
        .map((element) => element.outerHTML.slice(0, 80)),
    };
  });
}

const clean = { overflow: 0, smallText: [], smallTargets: [] };

const states: Record<string, (page: Page) => Promise<void>> = {
  agent: async (page) => {
    await page.goto("/app/test-harness");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  },
  empty: async (page) => {
    await openPreview(page);
    await expect(page.getByText("No messages yet.")).toBeVisible();
  },
  invalid: async (page) => {
    await openPreview(page);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Write a message first.")).toBeVisible();
  },
  pending: async (page) => {
    await openPreview(page);
    await runTurn(page, "timeout", "Hello");
    await expect(page.getByRole("status")).toHaveText("The agent is writing…");
  },
  answered: async (page) => {
    await openPreview(page);
    await runTurn(page, "answer", "Hello");
    await expect(lastTurn(page, "Outcome")).toHaveText("completed");
  },
  handoff: async (page) => {
    await openPreview(page);
    await runTurn(page, "refusal", "Hello");
    await expect(lastTurn(page, "Outcome")).toHaveText("refusal");
    await page.getByRole("button", { name: "Talk to a Person" }).click();
  },
  error: async (page) => {
    await openPreview(page);
    await runTurn(page, "crash", "Hello");
    await expect(page.getByText(/^Error reference: /)).toBeVisible();
  },
};

for (const [name, open] of Object.entries(states)) {
  for (const width of widths) {
    test(`${name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      expect(await layoutProblems(page)).toEqual(clean);
      await page.screenshot({
        path: `test-results/screens/${name}-${width}.png`,
        fullPage: true,
      });
      if (name !== "pending") await expectAccessible(page);
    });
  }
}

test("preview works with the keyboard alone", async ({ page }) => {
  await openPreview(page);
  await page.getByLabel("Message").focus();
  await page.keyboard.type("Hello");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Scripted model behavior")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(lastTurn(page, "Outcome")).toHaveText("completed");
  await page.getByRole("button", { name: "Send", exact: true }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "A person has the conversation.",
  );
});

test("a slow preview shows a loading message first", async ({ page }) => {
  // The prefetch brings the loading screen; only the navigation is slow.
  await page.route(/\/app\/test-harness\/preview/, async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    await route.continue();
  });
  const prefetched = page.waitForResponse(
    (response) =>
      response.url().includes("/app/test-harness/preview") &&
      Boolean(response.request().headers()["next-router-prefetch"]),
  );
  await page.goto("/app/test-harness");
  await prefetched;
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Open Preview" }).click();
  await expect(page.getByText("Loading the preview…")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Test preview" }),
  ).toBeVisible();
});

// WCAG 1.4.4. Reflow at 320px (1.4.10) is a separate criterion, tested above.
test("200 percent zoom of a 1280px window fits", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await openPreview(page);
  expect(await layoutProblems(page)).toEqual(clean);
});

// Only the preview itself: an injected font size does not move the rem-based
// breakpoints of the site header, as a real browser setting would.
for (const width of [1024, 1280]) {
  test(`200 percent text fits the preview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openPreview(page);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const overflow = await page.locator("main").evaluate((main) => {
      const edge = main.getBoundingClientRect().right;
      return [...main.querySelectorAll("*")].filter(
        (element) => element.getBoundingClientRect().right > edge + 1,
      ).length;
    });
    expect(overflow).toBe(0);
  });
}
