import {
  issueWidgetToken,
  type WidgetAudience,
} from "../../../lib/widget/tokens";
import { parseTokenKeys } from "../../../lib/widget/config";
import {
  hostUrl,
  widgetTestSecrets,
} from "../../../scripts/e2e-environment.mjs";
import { localDatabase } from "../support";
import {
  appCookies,
  appUrl,
  createKeyA,
  expect,
  expectHostUnharmed,
  expectNoWidget,
  frame,
  hostPage,
  launcher,
  openWidget,
  panel,
  revokeKey,
  siteA,
  test,
  visitorAddress,
} from "./widget-support";

const bootstrapUrl = `${appUrl}/api/widget/v1/bootstrap`;
const sessionUrl = `${appUrl}/api/widget/v1/session`;
const shopA = hostUrl("shop-a");
const secretKeys = parseTokenKeys(widgetTestSecrets);
if (!secretKeys) throw new Error("test secret");

/** A token signed with the real key of the running test server. */
function signed(
  audience: WidgetAudience,
  claims: { siteKeyId: string; origin?: string; id?: string },
  issuedAt = new Date(),
  signer = secretKeys,
) {
  return issueWidgetToken(
    { keys: signer ?? [], appOrigin: appUrl } as Parameters<
      typeof issueWidgetToken
    >[0],
    audience,
    { origin: shopA, id: crypto.randomUUID(), ...claims },
    issuedAt,
  );
}

test.describe("where the widget opens", () => {
  test("on a verified host it opens, says it is an AI and offers a person", async ({
    page,
    context,
    keys,
  }) => {
    await page.goto(hostPage("shop-a", { key: keys.a }));
    await openWidget(page);
    await expect(frame(page).getByRole("heading", { level: 1 })).toHaveText(
      "Tenant A satış asistanı",
    );
    await expect(
      frame(page).getByText("Ben bir yapay zekâ asistanıyım, insan değilim."),
    ).toBeVisible();
    await expect(
      frame(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    ).toHaveAttribute("href", "https://shop-a.example/contact");
    // P1.4: the conversation is open, with a labelled message box.
    await expect(
      frame(page).getByRole("textbox", { name: "Mesajınız" }),
    ).toBeVisible();

    await expectHostUnharmed(page);
    expect(await appCookies(context)).toEqual([]);
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    ).toEqual([0, 0]);
    const embedded = page
      .frames()
      .find((candidate) => candidate.url().startsWith(appUrl));
    // The frame keeps one thing, the anonymous visitor key, for this tab only
    // (device storage needs memory consent). Never the session token, never a cookie.
    expect(
      await embedded?.evaluate(() => [
        localStorage.length,
        sessionStorage.length,
        Object.keys(sessionStorage),
        /^[A-Za-z0-9_-]{43}$/.test(
          sessionStorage.getItem("cael.visitor") ?? "",
        ),
        document.cookie,
      ]),
    ).toEqual([0, 1, ["cael.visitor"], true, ""]);
  });

  test("the key may be in the script address, and the script at the end", async ({
    page,
    keys,
  }) => {
    await page.goto(hostPage("shop-a", { key: keys.a, in: "url", at: "end" }));
    await openWidget(page);
  });

  test("text follows the language of the site", async ({ page, keys }) => {
    await page.goto(hostPage("shop-b", { key: keys.b }));
    await openWidget(page);
    await expect(
      frame(page).getByText("I am an AI assistant, not a person."),
    ).toBeVisible();
    // Site B has no contact address: no dead link, but still a way to a person.
    await expect(frame(page).getByRole("link")).toHaveCount(0);
    await expect(frame(page).getByText("To talk to a person")).toBeVisible();
  });

  test("a wildcard covers one label and not two", async ({ page, keys }) => {
    await page.goto(hostPage("eu.wild-a", { key: keys.a }));
    await openWidget(page);
    await page.goto(hostPage("a.b.wild-a", { key: keys.a }));
    await expectNoWidget(page);
  });

  for (const [name, host] of [
    ["a foreign domain", "evil"],
    ["a name that contains an allowed one", "shop-a.evil"],
    ["a subdomain of an exact host", "www.shop-a"],
    ["an unverified domain", "unverified-a"],
    ["another customer's domain", "shop-b"],
  ] as const) {
    test(`it does not open on ${name}`, async ({ page, keys }) => {
      // A refusal carries no CORS header, so the browser keeps it from the page.
      const refused = page.waitForEvent("requestfailed", (failed) =>
        failed.url().startsWith(bootstrapUrl),
      );
      await page.goto(hostPage(host, { key: keys.a }));
      await refused;
      await expectNoWidget(page);
    });
  }

  test("preview hosts need the preview key, and it opens nothing else", async ({
    page,
    keys,
  }) => {
    await page.goto(hostPage("preview-a", { key: keys.aPreview }));
    await openWidget(page);
    for (const [host, key] of [
      ["preview-a", keys.a],
      ["shop-a", keys.aPreview],
      ["x.preview-a", keys.aPreview],
      ["evil", keys.aPreview],
    ] as const) {
      await page.goto(hostPage(host, { key }));
      await expectNoWidget(page);
    }
  });

  test("an unknown or malformed key opens nothing", async ({ page }) => {
    for (const key of [
      "cael_pk_00000000000000000000000000000000",
      "cael_pk_1",
      "",
      "<script>",
    ]) {
      await page.goto(hostPage("shop-a", { key }));
      await expectNoWidget(page);
    }
  });
});

test.describe("a copied key", () => {
  test("another page cannot read the bootstrap", async ({ page, keys }) => {
    await page.goto(hostPage("evil", { key: "" }));
    const outcome = await page.evaluate(
      async ({ url, key }) => {
        const attempt = (init: RequestInit) =>
          fetch(url, { method: "POST", body: JSON.stringify({ key }), ...init })
            .then(
              async (response) => `${response.type} ${await response.text()}`,
            )
            .catch((error: Error) => error.name);
        return [
          await attempt({}),
          await attempt({ credentials: "include" }),
          // The page cannot choose its Origin; browsers drop the header.
          await attempt({
            headers: { Origin: "http://shop-a.localhost:3212" },
          }),
          await attempt({ mode: "no-cors" }),
          await attempt({ headers: { "X-Custom": "1" } }),
        ];
      },
      { url: bootstrapUrl, key: keys.a },
    );
    expect(outcome).toEqual([
      "TypeError",
      "TypeError",
      "TypeError",
      "opaque ",
      "TypeError",
    ]);
  });

  test("a foreign page cannot frame the widget, even with a live ticket", async ({
    page,
    keys,
    request,
  }) => {
    // The worst case: the attacker's own server spoofed the Origin header.
    const stolen = await request.post(bootstrapUrl, {
      headers: { origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    expect(stolen.status()).toBe(200);
    const { frame: frameUrl } = (await stolen.json()) as { frame: string };

    await page.goto(hostPage("evil", { frame: frameUrl }));
    await expect
      .poll(() => page.frames().map((item) => item.url()))
      .toContain("chrome-error://chromewebdata/");

    // The same address is framed without complaint by the page it names.
    await page.goto(hostPage("shop-a", { frame: frameUrl }));
    await expect(
      page.frameLocator("#target").getByRole("heading", { level: 1 }),
    ).toBeVisible();
  });

  test("a frame opened as a page of its own does nothing", async ({
    page,
    keys,
    request,
  }) => {
    const answer = await request.post(bootstrapUrl, {
      headers: { origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    const { frame: frameUrl } = (await answer.json()) as { frame: string };
    await page.goto(frameUrl);
    await expect(page.locator("#state")).toHaveAttribute(
      "data-state",
      "unavailable",
    );
  });

  test("the frame ignores messages from anyone but its own page", async ({
    page,
    keys,
    request,
  }) => {
    const answer = await request.post(bootstrapUrl, {
      headers: { origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    const { frame: frameUrl, token } = (await answer.json()) as {
      frame: string;
      token: string;
    };
    const exchanges: string[] = [];
    page.on("request", (item) => {
      if (item.url() === sessionUrl) exchanges.push(item.method());
    });
    await page.goto(hostPage("shop-a", { frame: frameUrl }));
    const target = page.frameLocator("#target");
    await expect(target.locator("#state")).toHaveAttribute(
      "data-state",
      "loading",
    );
    // From inside the frame itself: right origin of nobody, wrong window.
    await target.locator("body").evaluate((_, value) => {
      window.postMessage({ cael: 1, type: "token", token: value }, "*");
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { cael: 1, type: "token", token: value },
          origin: "http://evil.localhost:3212",
          source: window.parent,
        }),
      );
    }, token);
    await page.waitForTimeout(400);
    expect(exchanges).toEqual([]);
  });
});

test.describe("a client outside a browser", () => {
  test.use({ extraHTTPHeaders: {} });
  const ip = () => ({ "x-real-ip": visitorAddress() });

  test("gets the same refusal for every wrong key and origin", async ({
    request,
    keys,
  }) => {
    const answers = [];
    for (const [origin, key] of [
      ["http://evil.localhost:3212", keys.a],
      [shopA, "cael_pk_00000000000000000000000000000000"],
      [shopA, keys.b],
      [hostUrl("unverified-a"), keys.a],
      ["null", keys.a],
      ["https://shop-a.localhost.evil.example", keys.a],
      [undefined, keys.a],
    ] as const) {
      const response = await request.post(bootstrapUrl, {
        headers: { ...ip(), ...(origin ? { origin } : {}) },
        data: JSON.stringify({ key }),
      });
      answers.push({
        status: response.status(),
        body: await response.text(),
        cors: response.headers()["access-control-allow-origin"],
      });
    }
    for (const answer of answers) {
      expect(answer).toEqual({
        status: 403,
        body: '{"error":{"code":"WIDGET_DENIED"}}',
        cors: undefined,
      });
    }
  });

  test("gets no preflight and no other method", async ({ request, keys }) => {
    const preflight = await request.fetch(bootstrapUrl, {
      method: "OPTIONS",
      headers: {
        ...ip(),
        origin: shopA,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(preflight.headers()["access-control-allow-headers"]).toBeUndefined();
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await request.fetch(`${bootstrapUrl}?key=${keys.a}`, {
        method,
        headers: { ...ip(), origin: shopA },
      });
      expect(response.status(), method).toBe(405);
    }
  });

  test("cannot use an expired, changed, foreign or repeated token", async ({
    request,
    keys,
  }) => {
    const exchange = async (token: string, embedder = shopA) => {
      const response = await request.post(sessionUrl, {
        headers: { ...ip(), origin: appUrl },
        data: { token, embedder },
      });
      return [response.status(), await response.text()] as const;
    };
    const siteKeyId = keys.aId;
    const rejected = [401, '{"error":{"code":"WIDGET_TOKEN_REJECTED"}}'];
    const foreignSigner = parseTokenKeys(
      `e2e:${Buffer.alloc(32, 9).toString("base64url")}`,
    );

    // Control: the very same call with a valid token works.
    const valid = signed("bootstrap", { siteKeyId });
    expect((await exchange(valid))[0]).toBe(201);
    // Replay of that token.
    expect(await exchange(valid)).toEqual(rejected);

    for (const [name, token, embedder] of [
      [
        "expired",
        signed("bootstrap", { siteKeyId }, new Date(Date.now() - 121_000)),
        shopA,
      ],
      [
        "wrong secret",
        signed("bootstrap", { siteKeyId }, new Date(), foreignSigner),
        shopA,
      ],
      ["frame ticket", signed("frame", { siteKeyId }), shopA],
      ["session token", signed("session", { siteKeyId }), shopA],
      [
        "another origin in the token",
        signed("bootstrap", {
          siteKeyId,
          origin: "http://evil.localhost:3212",
        }),
        "http://evil.localhost:3212",
      ],
      [
        "another page around the frame",
        signed("bootstrap", { siteKeyId }),
        hostUrl("wild-a"),
      ],
      [
        "unknown key id",
        signed("bootstrap", { siteKeyId: crypto.randomUUID() }),
        shopA,
      ],
      [
        "changed",
        `${signed("bootstrap", { siteKeyId }).slice(0, -2)}xx`,
        shopA,
      ],
    ] as const) {
      expect(await exchange(token, embedder), name).toEqual(rejected);
    }
  });

  test("cannot use a session after it expired, was revoked or lost its domain", async ({
    request,
  }) => {
    const { id: siteKeyId } = await createKeyA();
    const open = async () => {
      const response = await request.post(sessionUrl, {
        headers: { ...ip(), origin: appUrl },
        data: { token: signed("bootstrap", { siteKeyId }), embedder: shopA },
      });
      expect(response.status()).toBe(201);
      return ((await response.json()) as { session: string }).session;
    };
    const status = async (session: string, origin?: string) =>
      (
        await request.get(sessionUrl, {
          headers: {
            ...ip(),
            authorization: `Bearer ${session}`,
            ...(origin ? { origin } : {}),
          },
        })
      ).status();
    const admin = localDatabase();

    const session = await open();
    expect(await status(session)).toBe(200);
    expect(await status(session, "http://evil.localhost:3212")).toBe(403);
    expect(await status(`${session}x`)).toBe(401);

    // A token that the signature accepts, but whose session does not exist.
    expect(await status(signed("session", { siteKeyId }))).toBe(401);
    // Expired by its own clock.
    expect(
      await status(
        signed("session", { siteKeyId }, new Date(Date.now() - 1_801_000)),
      ),
    ).toBe(401);

    const revoked = await open();
    await admin
      .from("widget_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("site_key_id", siteKeyId);
    expect(await status(revoked)).toBe(401);

    const homeless = await open();
    await admin
      .from("domains")
      .update({ verification_method: null })
      .eq("hostname", "shop-a.localhost");
    expect(await status(homeless)).toBe(401);
    await admin
      .from("domains")
      .update({ verification_method: "dns_txt" })
      .eq("hostname", "shop-a.localhost");
    expect(await status(homeless)).toBe(200);

    await admin.from("sites").update({ is_active: false }).eq("id", siteA);
    expect(await status(homeless)).toBe(401);
    await admin.from("sites").update({ is_active: true }).eq("id", siteA);

    await revokeKey(siteKeyId);
    expect(await status(homeless)).toBe(401);
  });

  // What the domain lock does NOT do. Kept as a test so that nobody believes
  // otherwise: outside a browser, Origin is only a claim.
  test("can spoof Origin, and is then held by single use and rate limits", async ({
    request,
    keys,
  }) => {
    const address = ip();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 62; attempt += 1) {
      const response = await request.post(bootstrapUrl, {
        headers: { ...address, origin: shopA },
        data: JSON.stringify({ key: keys.a }),
      });
      statuses.push(response.status());
    }
    // A minute boundary may fall inside the loop, so the limit is a floor.
    expect(statuses[0]).toBe(200);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(
      0,
    );
    // Another visitor of the same site is not affected.
    const other = await request.post(bootstrapUrl, {
      headers: { ...ip(), origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    expect(other.status()).toBe(200);
  });

  test("leaves no address, key or host name in the server log", async ({
    request,
    keys,
  }) => {
    const address = visitorAddress();
    await request.post(bootstrapUrl, {
      headers: { "x-real-ip": address, origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    const { readFileSync } = await import("node:fs");
    const log = readFileSync("test-results/server/standard.log", "utf8");
    expect(log).toContain("widget.bootstrap_allowed");
    for (const value of [address, keys.a, "shop-a.localhost", "cw1."]) {
      expect(log, value).not.toContain(value);
    }
  });
});

test.describe("clickjacking", () => {
  for (const path of [
    "/",
    "/login",
    "/app",
    "/app/anything",
    "/api/health",
    "/widget/v1/frame",
    "/widget/v1/frame?t=x",
    "/widget/v1/loader.js",
  ]) {
    test(`${path} cannot be framed`, async ({ page, request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers()["x-frame-options"]).toBe("DENY");
      await page.goto(hostPage("shop-a", { frame: `${appUrl}${path}` }));
      await expect
        .poll(() => page.frames().map((item) => item.url()))
        .toContain("chrome-error://chromewebdata/");
    });
  }

  test("the widget frame has the strictest policy and no panel cookie", async ({
    request,
    keys,
  }) => {
    const answer = await request.post(bootstrapUrl, {
      headers: { origin: shopA },
      data: JSON.stringify({ key: keys.a }),
    });
    const { frame: frameUrl } = (await answer.json()) as { frame: string };
    const response = await request.get(frameUrl, {
      headers: { cookie: "sb-127-auth-token=base64-e30; other=1" },
    });
    const headers = response.headers();
    expect(headers["content-security-policy"]).toMatch(
      /^default-src 'none'; script-src 'sha256-[^']+'; style-src 'sha256-[^']+'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors http:\/\/shop-a\.localhost:3212$/,
    );
    expect(headers["x-frame-options"]).toBeUndefined();
    expect(headers["set-cookie"]).toBeUndefined();
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test("revoking a key closes an open widget at its next use", async ({
  page,
}) => {
  const { id, key } = await createKeyA();
  await page.goto(hostPage("shop-a", { key }));
  await openWidget(page);
  await frame(page).getByRole("button", { name: "Kapat" }).click();
  await expect(panel(page)).toBeHidden();
  await revokeKey(id);
  await launcher(page).click();
  await expect(frame(page).locator("#state")).toHaveAttribute(
    "data-state",
    "expired",
  );
  // Starting again does not help: the key itself is gone.
  await frame(page).getByRole("button", { name: "Yeniden başlat" }).click();
  await expect(frame(page).locator("#state")).toHaveAttribute(
    "data-state",
    "failed",
  );
  await page.reload();
  await expectNoWidget(page);
});
