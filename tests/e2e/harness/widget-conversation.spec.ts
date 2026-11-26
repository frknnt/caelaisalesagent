import type { Page } from "@playwright/test";

import {
  knowledgeWorkerTestToken,
  serverUrl,
} from "../../../scripts/e2e-environment.mjs";
import { expectAccessible, localDatabase } from "../support";
import {
  expect,
  frame,
  hostPage,
  launcher,
  test,
} from "../widget/widget-support";

// The owner adds a source in the panel; the visitor asks on the customer's
// site. The harness build has deterministic embeddings; the LLM is the demo
// adapter (no network, no cost). Together this is the Demo gate journey.
const app = serverUrl("harness");
const tenantA = "a0000000-0000-4000-8000-000000000001";
const question = "Teslimat süresi ne kadar?";
const sourceText =
  "Teslimat süresi 2 iş günüdür. Siparişler aynı gün kargoya verilir.";

test.use({ storageState: "tmp/e2e/owner-a.json" });

async function resetConversations() {
  const database = localDatabase();
  await database
    .from("visitor_identities")
    .delete()
    .eq("organization_id", tenantA);
}

async function addApprovedSource(page: Page) {
  await localDatabase()
    .from("knowledge_sources")
    .delete()
    .eq("organization_id", tenantA);
  await page.goto(`${app}/app/knowledge`);
  const form = page.locator("form").filter({ hasText: "Manual text or FAQ" });
  await form.getByLabel("Name").fill("Teslimat SSS");
  await form.getByLabel("Content").fill(sourceText);
  await form.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByRole("status")).toContainText("queued for ingestion");
  let processed = false;
  for (let attempt = 0; attempt < 5 && !processed; attempt += 1) {
    const response = await page.request.post(`${app}/api/internal/ingestion`, {
      headers: { authorization: `Bearer ${knowledgeWorkerTestToken}` },
    });
    expect(response.ok()).toBe(true);
    processed = Boolean((await response.json()).processed);
  }
  expect(processed).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
}

const chat = (page: Page) => frame(page);
const input = (page: Page) =>
  chat(page).getByRole("textbox", { name: "Mesajınız" });
const replies = (page: Page) => chat(page).locator("#log .msg.assistant");

async function openChat(page: Page, key: string) {
  await page.goto(hostPage("shop-a", { key, app }));
  await launcher(page).click();
  await expect(chat(page).locator("#state")).toHaveAttribute(
    "data-state",
    "ready",
  );
}

test.beforeEach(async () => {
  await resetConversations();
});

test.afterAll(async () => {
  await resetConversations();
  await localDatabase()
    .from("knowledge_sources")
    .delete()
    .eq("organization_id", tenantA);
});

test("a visitor gets a sourced, streamed answer and keeps it across a refresh", async ({
  page,
  keys,
}) => {
  test.setTimeout(60_000);
  await addApprovedSource(page);
  await openChat(page, keys.a);

  // Empty state: suggested prompts, AI disclosure, the way to a person.
  await expect(chat(page).locator("#prompts button")).toHaveCount(3);
  await expect(
    chat(page).getByText("Ben bir yapay zekâ asistanıyım, insan değilim.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    chat(page).getByRole("button", { name: "Dosya ekle" }),
  ).toBeVisible();

  await input(page).fill(question);
  await input(page).press("Enter");
  const reply = replies(page).last();
  await expect(reply).toContainText("Teslimat süresi 2 iş günüdür", {
    timeout: 15_000,
  });
  await expect(reply).toContainText("Ben bir yapay zekâ asistanıyım");
  await expect(reply.locator(".sources")).toContainText("Teslimat SSS");
  await expect(reply).not.toHaveAttribute("aria-busy", "true");
  // Screen readers hear the finished answer once, from a polite live region.
  await expect(chat(page).locator("#announce")).toContainText(
    "Teslimat süresi 2 iş günüdür",
  );
  await expect(chat(page).locator("#prompts")).toBeHidden();

  await reply.getByRole("button", { name: "Faydalı", exact: true }).click();
  await expect(
    reply.getByRole("button", { name: "Faydalı", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Refresh: a new page, a new technical session, the same conversation.
  await page.reload();
  await launcher(page).click();
  await expect(replies(page)).toHaveCount(1);
  await expect(replies(page).first()).toContainText(
    "Teslimat süresi 2 iş günüdür",
  );
  await expect(
    replies(page).first().getByRole("button", { name: "Faydalı", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const { data } = await localDatabase()
    .from("messages")
    .select("role, status, feedback, citations")
    .eq("organization_id", tenantA);
  expect(data?.map((row) => `${row.role}:${row.status}`).sort()).toEqual([
    "assistant:completed",
    "visitor:completed",
  ]);
  await expectAccessible(page);
});

test("a second Enter while the answer is coming adds nothing", async ({
  page,
  keys,
}) => {
  await openChat(page, keys.a);
  await input(page).fill("Merhaba");
  await input(page).press("Enter");
  await input(page).fill("Merhaba");
  await input(page).press("Enter");
  await expect(replies(page).first()).not.toHaveAttribute("aria-busy", "true", {
    timeout: 15_000,
  });
  await page.waitForTimeout(300);
  const { data } = await localDatabase()
    .from("messages")
    .select("role")
    .eq("organization_id", tenantA);
  expect(data?.filter((row) => row.role === "visitor")).toHaveLength(1);
  expect(data?.filter((row) => row.role === "assistant")).toHaveLength(1);
});

test("a dropped answer is found again, and a failed send can be sent again", async ({
  page,
  keys,
}) => {
  test.setTimeout(60_000);
  await openChat(page, keys.a);

  // The server answers, the connection drops before the page reads it.
  await page.route(`${app}/api/widget/v1/messages`, async (route) => {
    await route.fetch();
    await route.abort("connectionreset");
  });
  await input(page).fill("Kargo ücretli mi?");
  await input(page).press("Enter");
  await expect(replies(page).last()).not.toHaveAttribute("aria-busy", "true", {
    timeout: 20_000,
  });
  await expect(replies(page).last()).not.toHaveClass(/error/);
  await page.unroute(`${app}/api/widget/v1/messages`);

  // Offline before the server saw it: say so, offer the same message again.
  await page.route(`${app}/api/widget/v1/messages`, (route) =>
    route.abort("internetdisconnected"),
  );
  await input(page).fill("İade mümkün mü?");
  await input(page).press("Enter");
  const failed = replies(page).last();
  await expect(failed).toContainText("Bağlantı koptu.", { timeout: 30_000 });
  await page.unroute(`${app}/api/widget/v1/messages`);
  await failed.getByRole("button", { name: "Tekrar gönder" }).click();
  await expect(replies(page).last()).not.toHaveClass(/error/, {
    timeout: 15_000,
  });
  await expect(replies(page).last()).not.toHaveAttribute("aria-busy", "true");

  const { data } = await localDatabase()
    .from("messages")
    .select("role, status")
    .eq("organization_id", tenantA);
  expect(data?.filter((row) => row.role === "visitor")).toHaveLength(2);
  expect(
    data?.filter(
      (row) => row.role === "assistant" && row.status === "completed",
    ),
  ).toHaveLength(2);
});

test("works with the keyboard alone", async ({ page, keys }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openChat(page, keys.a);
  await expect(chat(page).locator("#title")).toBeFocused();
  const order = [
    chat(page).getByRole("button", { name: "Kapat" }),
    chat(page).locator("#prompts button").nth(0),
    chat(page).locator("#prompts button").nth(1),
    chat(page).locator("#prompts button").nth(2),
    input(page),
    chat(page).getByRole("button", { name: "Dosya ekle" }),
    chat(page).getByRole("button", { name: "Gönder" }),
    chat(page).getByRole("link", { name: "Bir kişiyle görüş" }),
    chat(page).getByRole("checkbox", { name: "Bu cihazda konuşmamı hatırla" }),
  ];
  for (const stop of order) {
    await page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
  }
  // Attachments are not offered yet, and the frame says so.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(
    chat(page).getByRole("button", { name: "Dosya ekle" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chat(page).locator("#attach-note")).toHaveText(
    "Dosya ekleme bu sürümde henüz yok.",
  );

  // Shift+Enter is a new line, Enter sends.
  await input(page).focus();
  await page.keyboard.type("Satır bir");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("satır iki");
  await expect(input(page)).toHaveValue("Satır bir\nsatır iki");
  await page.keyboard.press("Enter");
  await expect(input(page)).toHaveValue("");
  await expect(chat(page).locator("#log .msg.visitor")).toHaveCount(1);
});

test("memory consent is asked, recorded and can be withdrawn", async ({
  page,
  keys,
}) => {
  await openChat(page, keys.a);
  const remember = chat(page).getByRole("checkbox", {
    name: "Bu cihazda konuşmamı hatırla",
  });
  await expect(remember).not.toBeChecked();
  await remember.check();
  await expect(chat(page).locator("#announce")).toHaveText(
    "Konuşmanız bu cihazda hatırlanacak.",
  );
  await remember.uncheck();
  await expect(chat(page).locator("#announce")).toHaveText(
    "Konuşmanız sonraki ziyarette hatırlanmayacak.",
  );
  const { data } = await localDatabase()
    .from("visitor_consents")
    .select("granted, purpose, text_version, source")
    .eq("organization_id", tenantA)
    .order("recorded_at");
  expect(data).toEqual([
    {
      granted: true,
      purpose: "conversation_memory",
      text_version: "memory-2026-11-26",
      source: "widget",
    },
    {
      granted: false,
      purpose: "conversation_memory",
      text_version: "memory-2026-11-26",
      source: "widget",
    },
  ]);
});

test("a server error is shown with a way to send again and a way to a person", async ({
  page,
  keys,
}) => {
  await openChat(page, keys.a);
  await page.route(`${app}/api/widget/v1/messages`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":{"code":"WIDGET_REPLY_FAILED"}}',
    }),
  );
  await input(page).fill("Fiyat nedir?");
  await input(page).press("Enter");
  const failed = replies(page).last();
  await expect(failed).toContainText("Yanıt alınamadı.");
  await expect(
    failed.getByRole("button", { name: "Tekrar gönder" }),
  ).toBeVisible();
  await expect(
    chat(page).getByRole("link", { name: "Bir kişiyle görüş" }),
  ).toBeVisible();
  await expectAccessible(page);
});

for (const width of [375, 1440]) {
  test(`loading, empty, answered and error states at ${width}px`, async ({
    page,
    keys,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
    let hold = true;
    await page.route(`${app}/api/widget/v1/visitor`, async (route) => {
      while (hold) await new Promise((resolve) => setTimeout(resolve, 50));
      await route.continue();
    });
    await page.goto(hostPage("shop-a", { key: keys.a, app }));
    await launcher(page).click();
    await expect(chat(page).locator("#state")).toHaveAttribute(
      "data-state",
      "loading",
    );
    await page.screenshot({
      path: `test-results/screens/chat-loading-${width}.png`,
    });
    hold = false;
    await expect(chat(page).locator("#state")).toHaveAttribute(
      "data-state",
      "ready",
    );
    await page.screenshot({
      path: `test-results/screens/chat-empty-${width}.png`,
    });
    await expectAccessible(page);

    await input(page).fill(question);
    await input(page).press("Enter");
    await expect(replies(page).last()).not.toHaveAttribute(
      "aria-busy",
      "true",
      { timeout: 15_000 },
    );
    await page.screenshot({
      path: `test-results/screens/chat-answered-${width}.png`,
    });
    const overflow = await chat(page)
      .locator("body")
      .evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
    expect(overflow).toBe(0);

    await page.route(`${app}/api/widget/v1/messages`, (route) =>
      route.fulfill({
        status: 429,
        headers: { "retry-after": "5" },
        contentType: "application/json",
        body: '{"error":{"code":"WIDGET_RATE_LIMITED"}}',
      }),
    );
    await input(page).fill("Bir soru daha");
    await input(page).press("Enter");
    await expect(replies(page).last()).toContainText(
      "Çok hızlı mesaj gönderdiniz.",
    );
    await page.screenshot({
      path: `test-results/screens/chat-error-${width}.png`,
    });
    await expectAccessible(page);
  });
}
