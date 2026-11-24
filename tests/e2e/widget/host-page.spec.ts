import { expectAccessible } from "../support";
import {
  appUrl,
  expect,
  expectHostUnharmed,
  expectNoWidget,
  frame,
  handoffUrl,
  hostPage,
  launcher,
  openWidget,
  panel,
  test,
} from "./widget-support";

const bootstrapUrl = `${appUrl}/api/widget/v1/bootstrap`;
const loaderUrl = `${appUrl}/widget/v1/loader.js`;

test.describe("a broken widget leaves the page alone", () => {
  const cors = { "access-control-allow-origin": "*" };
  const answers: Record<
    string,
    Parameters<import("@playwright/test").Route["fulfill"]>[0]
  > = {
    "403": { status: 403, body: "{}" },
    "429": {
      status: 429,
      headers: { ...cors, "retry-after": "60" },
      body: "{}",
    },
    "500": { status: 500, headers: cors, body: "Internal Server Error" },
    "a redirect": { status: 302, headers: { ...cors, location: "/elsewhere" } },
    "an empty answer": { status: 200, headers: cors, body: "" },
    "broken JSON": { status: 200, headers: cors, body: '{"frame":' },
    "a web page": { status: 200, headers: cors, body: "<html></html>" },
    null: { status: 200, headers: cors, body: "null" },
    "a frame on another server": {
      status: 200,
      headers: cors,
      body: JSON.stringify({
        frame: "http://evil.localhost:3212/widget/v1/frame?t=1",
        token: "x",
        expiresIn: 120,
        title: "x",
        theme: { accent: "#000000" },
        copy: {
          lang: "en",
          open: "x",
          close: "x",
          loading: "x",
          failed: "x",
          retry: "x",
          person: "x",
          personFallback: "x",
        },
      }),
    },
  };
  for (const [name, answer] of Object.entries(answers)) {
    test(`bootstrap answers with ${name}`, async ({ page, keys }) => {
      await page.route(bootstrapUrl, (route) => route.fulfill(answer));
      await page.goto(hostPage("shop-a", { key: keys.a }));
      await expectNoWidget(page);
    });
  }

  test("the server is down", async ({ page, keys }) => {
    await page.route(`${appUrl}/**`, (route) =>
      route.abort("connectionrefused"),
    );
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await expectNoWidget(page);
  });

  test("bootstrap is unreachable", async ({ page, keys }) => {
    await page.route(bootstrapUrl, (route) => route.abort("timedout"));
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await expectNoWidget(page);
  });

  for (const status of [404, 500]) {
    test(`the script itself answers ${status}`, async ({ page, keys }) => {
      await page.route(loaderUrl, (route) =>
        route.fulfill({ status, body: "nope" }),
      );
      await page.goto(hostPage("shop-a", { key: keys.a }));
      await expectNoWidget(page);
    });
  }

  for (const part of [loaderUrl, bootstrapUrl]) {
    test(`a hanging ${part.slice(appUrl.length)} does not hold up the page`, async ({
      page,
      keys,
    }) => {
      await page.route(part, () => new Promise(() => {}));
      const started = Date.now();
      await page.goto(hostPage("shop-a", { key: keys.a }), {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("#content")).toBeVisible();
      await page.locator("#buy").click();
      await expect(page.locator("#buy")).toHaveText("Added");
      expect(Date.now() - started).toBeLessThan(3_000);
      await expect(launcher(page)).toHaveCount(0);
    });
  }

  test("a slow bootstrap gives up and cleans up", async ({ page, keys }) => {
    await page.route(bootstrapUrl, () => new Promise(() => {}));
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await expect(page.locator("cael-widget")).toHaveCount(1);
    await expect(page.locator("cael-widget")).toBeHidden();
    await expect(page.locator("cael-widget")).toHaveCount(0, {
      timeout: 8_000,
    });
    await expectHostUnharmed(page);
  });

  for (const broken of ["fetch", "shadow", "abort"]) {
    test(`the page has no ${broken}`, async ({ page, keys }) => {
      await page.goto(hostPage("shop-a", { key: keys.a, break: broken }));
      await expectNoWidget(page);
    });
  }

  for (const broken of ["sheet", "prototype", "media"]) {
    test(`the page has a strange ${broken}, and the widget still works`, async ({
      page,
      keys,
    }) => {
      await page.goto(hostPage("shop-a", { key: keys.a, break: broken }));
      await openWidget(page);
      await expectHostUnharmed(page);
    });
  }

  test("the frame never answers: the visitor can retry or reach a person", async ({
    page,
    keys,
  }) => {
    test.setTimeout(40_000);
    let hang = true;
    await page.route(`${appUrl}/widget/v1/frame?**`, (route) =>
      hang
        ? route.fulfill({ status: 500, body: "Internal Server Error" })
        : route.continue(),
    );
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await launcher(page).click();
    await expect(panel(page).getByRole("status")).toHaveText("Bağlanıyor…");
    const alert = panel(page).getByRole("alert");
    await expect(alert).toHaveText("Bağlantı kurulamadı.", { timeout: 12_000 });
    await expect(
      panel(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    ).toHaveAttribute("href", handoffUrl);
    await expectAccessible(page);

    hang = false;
    await panel(page).getByRole("button", { name: "Tekrar dene" }).click();
    await expect(frame(page).locator("#state")).toHaveAttribute(
      "data-state",
      "ready",
    );
    await expectHostUnharmed(page);
  });

  for (const status of [401, 403, 429, 500]) {
    test(`the session answers ${status}: the frame says so and recovers`, async ({
      page,
      keys,
    }) => {
      let broken = true;
      await page.route(`${appUrl}/api/widget/v1/session`, (route) =>
        broken ? route.fulfill({ status, body: "{}" }) : route.continue(),
      );
      await page.goto(hostPage("shop-a", { key: keys.a }));
      await launcher(page).click();
      await expect(frame(page).locator("#status")).toHaveText(
        "Bağlantı kurulamadı.",
      );
      await expect(
        frame(page).getByRole("link", { name: "Bir kişiyle görüş" }),
      ).toBeVisible();
      broken = false;
      await frame(page).getByRole("button", { name: "Tekrar dene" }).click();
      await expect(frame(page).locator("#state")).toHaveAttribute(
        "data-state",
        "ready",
      );
      await expectHostUnharmed(page);
    });
  }

  test("an expired session says so and can start again", async ({
    page,
    keys,
  }) => {
    let shorten = true;
    await page.route(`${appUrl}/api/widget/v1/session`, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as object;
      await route.fulfill({
        response,
        json: shorten ? { ...body, expiresIn: 1 } : body,
      });
    });
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await launcher(page).click();
    await expect(frame(page).locator("#status")).toHaveText(
      "Oturumun süresi doldu.",
    );
    shorten = false;
    await frame(page).getByRole("button", { name: "Yeniden başlat" }).click();
    await expect(frame(page).locator("#state")).toHaveAttribute(
      "data-state",
      "ready",
    );
  });

  test("a page that was open for a long time still opens the widget", async ({
    page,
    keys,
  }) => {
    await page.route(bootstrapUrl, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as object;
      await route.fulfill({ response, json: { ...body, expiresIn: 0.2 } });
    });
    let calls = 0;
    page.on("request", (request) => {
      if (request.url() === bootstrapUrl) calls += 1;
    });
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await expect(launcher(page)).toBeVisible();
    await page.waitForTimeout(400);
    await openWidget(page);
    expect(calls).toBeGreaterThan(1);
  });
});

test.describe("the page's own Content Security Policy", () => {
  test("a strict policy with Trusted Types that names the app works", async ({
    page,
    keys,
  }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Trusted/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    await page.goto(hostPage("shop-a", { key: keys.a, csp: "strict" }));
    await openWidget(page);
    // The inline onclick of the test page itself is the only thing blocked.
    expect(
      violations.filter(
        (text) => !/inline event handler|script-src-attr/i.test(text),
      ),
    ).toEqual([]);
    const size = await launcher(page).boundingBox();
    expect(size).toMatchObject({ width: 56, height: 56 });
  });

  for (const csp of ["no-script", "no-connect"]) {
    test(`${csp}: nothing appears and nothing breaks`, async ({
      page,
      keys,
    }) => {
      await page.goto(hostPage("shop-a", { key: keys.a, csp }));
      await page.waitForTimeout(400);
      await expect(page.locator("cael-widget")).toHaveCount(0);
      await expect(page.locator("#content")).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { hostErrors?: string[] }).hostErrors ?? [],
        ),
      ).toEqual([]);
    });
  }

  test("no-frame: the panel explains it and offers a person", async ({
    page,
    keys,
  }) => {
    test.setTimeout(40_000);
    await page.goto(hostPage("shop-a", { key: keys.a, csp: "no-frame" }));
    await launcher(page).click();
    await expect(panel(page).getByRole("alert")).toHaveText(
      "Bağlantı kurulamadı.",
      { timeout: 12_000 },
    );
    await expect(
      panel(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    ).toBeVisible();
  });
});

test.describe("isolation from the page", () => {
  test("no global, one element, nothing in the page's own text", async ({
    page,
    keys,
  }) => {
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await openWidget(page);
    const state = await page.evaluate(() => ({
      added: Object.getOwnPropertyNames(window).filter(
        (name) =>
          !(
            window as unknown as { hostGlobals: string[] }
          ).hostGlobals.includes(name) &&
          // Set by the page's own probe, or an index of the iframe list.
          !["hostGlobals", "0"].includes(name),
      ),
      children: [...document.body.children].map(({ tagName }) => tagName),
      text: document.body.innerText,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
    expect(state.added).toEqual([]);
    expect(state.children).toEqual(["MAIN", "CAEL-WIDGET"]);
    expect(state.text).not.toContain("asistan");
    expect(state.overflow).toBe(0);
  });

  test("two copies of the script make one widget", async ({ page, keys }) => {
    let calls = 0;
    page.on("request", (request) => {
      if (request.url() === bootstrapUrl) calls += 1;
    });
    await page.goto(hostPage("shop-a", { key: keys.a, copies: "3" }));
    await openWidget(page);
    await expect(page.locator("cael-widget")).toHaveCount(1);
    expect(calls).toBe(1);
    await expectHostUnharmed(page);
  });

  test("hostile page styles do not reach the widget", async ({
    page,
    keys,
  }) => {
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await openWidget(page);
    const measure = () =>
      page.evaluate(() => {
        const root = document.querySelector("cael-widget")?.shadowRoot;
        return ["button.launcher", ".panel", "iframe"].map((selector) => {
          const element = root?.querySelector(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            selector,
            box: [box.x, box.y, box.width, box.height].map(Math.round),
            color: style.color,
            display: style.display,
            fontSize: style.fontSize,
            letterSpacing: style.letterSpacing,
            opacity: style.opacity,
          };
        });
      });
    await page.waitForTimeout(250);
    const calm = await measure();
    await page.goto(hostPage("shop-a", { key: keys.a, css: "hostile" }));
    await openWidget(page);
    await page.waitForTimeout(250);
    expect(await measure()).toEqual(calm);
  });
});
