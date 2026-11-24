import type { Page } from "@playwright/test";

import { expectAccessible } from "../support";
import {
  appUrl,
  expect,
  frame,
  hostPage,
  launcher,
  openWidget,
  panel,
  test,
} from "./widget-support";

const widths = [320, 375, 768, 1024, 1440];
const sessionUrl = `${appUrl}/api/widget/v1/session`;

/** Text under 14px, targets under 44px and anything outside its window. */
function layoutProblems(host: Element) {
  const width = document.documentElement.clientWidth;
  const root = host.shadowRoot ?? host;
  const visible = [...root.querySelectorAll<HTMLElement>("*")].filter(
    (element) =>
      element.getClientRects().length > 0 &&
      !["STYLE", "SCRIPT"].includes(element.tagName),
  );
  const ownText = (element: HTMLElement) =>
    [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
  const describe = (element: HTMLElement) => element.outerHTML.slice(0, 80);
  return {
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    smallText: visible
      .filter(
        (element) =>
          ownText(element) &&
          Number.parseFloat(getComputedStyle(element).fontSize) < 14,
      )
      .map(describe),
    smallTargets: visible
      .filter((element) => element.matches("a, button"))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.height < 44 || box.width < 44;
      })
      .map(describe),
    outside: visible
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.left < -1 || box.right > width + 1;
      })
      .map(describe),
  };
}

const clean = { overflow: 0, smallText: [], smallTargets: [], outside: [] };

async function expectCleanLayout(page: Page, hasFrame: boolean) {
  expect(await page.locator("cael-widget").evaluate(layoutProblems)).toEqual(
    clean,
  );
  if (!hasFrame) return;
  expect(await frame(page).locator("body").evaluate(layoutProblems)).toEqual(
    clean,
  );
}

const states: Record<string, (page: Page, key: string) => Promise<void>> = {
  closed: async (page, key) => {
    await page.goto(hostPage("shop-a", { key }));
    await expect(launcher(page)).toBeVisible();
  },
  loading: async (page, key) => {
    await page.route(sessionUrl, () => new Promise(() => {}));
    await page.goto(hostPage("shop-a", { key }));
    await launcher(page).click();
    await expect(frame(page).locator("#state")).toHaveAttribute(
      "data-state",
      "loading",
    );
  },
  // Open, with no conversation yet.
  empty: async (page, key) => {
    await page.goto(hostPage("shop-a", { key }));
    await openWidget(page);
  },
  error: async (page, key) => {
    await page.route(sessionUrl, (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );
    await page.goto(hostPage("shop-a", { key }));
    await launcher(page).click();
    await expect(frame(page).locator("#state")).toHaveAttribute(
      "data-state",
      "failed",
    );
  },
  expired: async (page, key) => {
    await page.route(sessionUrl, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { ...((await response.json()) as object), expiresIn: 0 },
      });
    });
    await page.goto(hostPage("shop-a", { key }));
    await launcher(page).click();
    await expect(frame(page).locator("#state")).toHaveAttribute(
      "data-state",
      "expired",
    );
  },
};

for (const [name, open] of Object.entries(states)) {
  for (const width of widths) {
    test(`${name} at ${width}px`, async ({ page, keys }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, keys.a);
      await page.waitForTimeout(250);
      await expectCleanLayout(page, name !== "closed");
      await page.screenshot({
        path: `test-results/screens/widget-${name}-${width}.png`,
      });
      await expectAccessible(page);
    });
  }
}

test("the way to a person stays on screen when everything else fails", async ({
  page,
  keys,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 640 });
    await states.error?.(page, keys.a);
    await expect(
      frame(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    ).toBeInViewport();
    await page.unroute(sessionUrl);
  }
});

test("works with the keyboard alone", async ({ page, keys }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await expect(launcher(page)).toBeVisible();
  await page.locator("#buy").focus();
  await page.keyboard.press("Tab");
  await expect(launcher(page)).toBeFocused();
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Enter");
  await expect(frame(page).locator("#title")).toBeFocused();
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "true");
  await expect(frame(page).locator("#state")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await page.keyboard.press("Tab");
  await expect(
    frame(page).getByRole("button", { name: "Kapat" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    frame(page).getByRole("link", { name: "Bir kişiyle görüş" }),
  ).toBeFocused();
  // Beside the page it is not modal: Tab leaves towards the launcher.
  await page.keyboard.press("Tab");
  await expect(launcher(page)).toBeFocused();

  await page.keyboard.press("Space");
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(frame(page).locator("#title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

test("Escape also closes while the frame is still loading", async ({
  page,
  keys,
}) => {
  await page.route(`${appUrl}/widget/v1/frame?**`, () => new Promise(() => {}));
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await launcher(page).focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeFocused();
  await expect(panel(page).getByRole("status")).toHaveText("Bağlanıyor…");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

test("on a phone it covers the page and keeps the focus inside", async ({
  page,
  keys,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await openWidget(page);
  await expect(panel(page)).toHaveAttribute("aria-modal", "true");
  await expect(launcher(page)).toBeHidden();
  expect(await panel(page).boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 375,
    height: 700,
  });
  const close = frame(page).getByRole("button", { name: "Kapat" });
  const person = frame(page).getByRole("link", { name: "Bir kişiyle görüş" });
  for (const target of [close, person, close, person]) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  }
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(person).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

test("focus does not vanish with the button that had it", async ({
  page,
  keys,
}) => {
  let broken = true;
  await page.route(sessionUrl, (route) =>
    broken ? route.fulfill({ status: 500, body: "{}" }) : route.continue(),
  );
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await launcher(page).click();
  const retry = frame(page).getByRole("button", { name: "Tekrar dene" });
  await expect(retry).toBeVisible();
  broken = false;
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(frame(page).locator("#state")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await expect(frame(page).locator("#title")).toBeFocused();
});

test("reduced motion removes the movement", async ({ page, keys }) => {
  const duration = () =>
    panel(page).evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await openWidget(page);
  expect(await duration()).toContain("0.14s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await openWidget(page);
  expect(await duration()).toBe("0s");
});

test("200 percent zoom of a 1280px window fits", async ({ page, keys }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await openWidget(page);
  await page.waitForTimeout(250);
  await expectCleanLayout(page, true);
});

test("200 percent text fits the frame", async ({ page, keys }) => {
  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await openWidget(page);
    await frame(page)
      .locator("html")
      .evaluate((html) => {
        (html as HTMLElement).style.fontSize = "200%";
      });
    expect(
      await frame(page)
        .locator("html")
        .evaluate((html) => html.scrollWidth - html.clientWidth),
    ).toBe(0);
    await frame(page)
      .getByRole("link", { name: "Bir kişiyle görüş" })
      .scrollIntoViewIfNeeded();
    await expect(
      frame(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    ).toBeInViewport();
  }
});

test("forced colors keep the launcher visible", async ({ page, keys }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await expect(launcher(page)).toBeVisible();
  expect(
    await launcher(page).evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
  ).toBe("2px");
  await openWidget(page);
  await page.screenshot({
    path: "test-results/screens/widget-forced-colors.png",
  });
});

test("the theme color reaches the launcher and the frame, with readable text", async ({
  page,
  keys,
}) => {
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await openWidget(page);
  const colors = (element: Element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.color];
  };
  const expected = ["rgb(11, 113, 136)", "rgb(255, 255, 255)"];
  expect(await launcher(page).evaluate(colors)).toEqual(expected);
  expect(await frame(page).locator(".top").evaluate(colors)).toEqual(expected);
});

test("a hover only prepares; a session starts when the widget opens", async ({
  page,
  keys,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url() === sessionUrl) calls.push("session");
    if (request.url().includes("/widget/v1/frame?")) calls.push("frame");
  });
  await page.goto(hostPage("shop-a", { key: keys.a }));
  await expect(launcher(page)).toBeVisible();
  await page.waitForTimeout(200);
  expect(calls).toEqual([]);
  await launcher(page).hover();
  await expect.poll(() => calls).toEqual(["frame"]);
  await page.waitForTimeout(300);
  expect(calls).toEqual(["frame"]);
  await openWidget(page);
  expect(calls).toEqual(["frame", "session"]);
});
