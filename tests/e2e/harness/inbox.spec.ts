import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../db/database.types";

import {
  expect,
  expectAccessible,
  localDatabase,
  ownerA,
  seedPassword,
  test,
} from "../support";

test.use({ storageState: "tmp/e2e/owner-a.json" });

let conversationId = "";
let visitorMessage = "";

async function seedConversation() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const browserClient = createClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signedIn = await browserClient.auth.signInWithPassword({
    email: ownerA,
    password: seedPassword,
  });
  expect(signedIn.error).toBeNull();
  let { data: keys } = await browserClient
    .from("site_keys")
    .select("id")
    .eq("site_id", "a0000000-0000-4000-8000-000000000101")
    .eq("environment", "production")
    .is("revoked_at", null)
    .limit(1);
  if (!keys?.[0]) {
    const created = await browserClient.rpc("create_site_key", {
      p_site_id: "a0000000-0000-4000-8000-000000000101",
      p_environment: "production",
      p_expires_at: null as unknown as string,
    });
    expect(created.error).toBeNull();
    keys = created.data ? [{ id: created.data.id }] : [];
  }
  const siteKeyId = keys?.[0]?.id;
  expect(siteKeyId).toBeTruthy();
  const database = localDatabase();
  const session = await database.rpc("create_widget_session", {
    p_site_key_id: siteKeyId ?? "",
    p_hostname: "tenant-a.example.test",
    p_origin: "https://tenant-a.example.test",
    p_bootstrap_id: randomUUID(),
    p_client_hash: createHash("sha256").update(randomUUID()).digest("hex"),
    p_ttl_seconds: 1800,
  });
  expect(session.error).toBeNull();
  const sessionId = session.data?.[0]?.session_id;
  expect(sessionId).toBeTruthy();
  const attached = await database.rpc("widget_attach_visitor", {
    p_widget_session_id: sessionId ?? "",
    p_secret_hash: null as unknown as string,
    p_new_secret_hash: createHash("sha256")
      .update(randomUUID())
      .digest("base64url"),
  });
  expect(attached.error).toBeNull();
  visitorMessage = `Bu hafta urun demosu planlamak istiyorum. Ref ${randomUUID().slice(0, 8)}`;
  const posted = await database.rpc("widget_post_message", {
    p_widget_session_id: sessionId ?? "",
    p_client_message_id: randomUUID(),
    p_body: visitorMessage,
  });
  expect(posted.error).toBeNull();
  conversationId = posted.data?.[0]?.conversation_id ?? "";
  expect(conversationId).toBeTruthy();
  const replyId = posted.data?.[0]?.reply_id;
  expect(replyId).toBeTruthy();
  const completed = await database.rpc("widget_complete_reply", {
    p_reply_id: replyId ?? "",
    p_status: "completed",
    p_body: "Demo talebinizi satis ekibine iletiyorum.",
    p_citations: [],
    p_handoff: false,
    p_prompt_version: "e2e-p1.5",
  });
  expect(completed.error).toBeNull();
  const context = await database.rpc("inbox_set_lead_context", {
    p_conversation_id: conversationId,
    p_context: { intent: "demo", budget: "confirmed", score: 82 },
  });
  expect(context.error).toBeNull();
}

test.beforeEach(async () => seedConversation());

test("representative takes over with context, replies, notes and returns to bot", async ({
  page,
}) => {
  await page.goto(
    `/app/inbox?conversation=${conversationId}&q=${encodeURIComponent(visitorMessage)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Conversation inbox" }),
  ).toBeVisible();
  await expect(page.getByText("Live updates on")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Conversations" })
      .locator(`a[href*="conversation=${conversationId}"]`),
  ).toBeVisible();
  await expect(page.getByText(visitorMessage).first()).toBeVisible();
  await expect(page.getByText(/"score": 82/)).toBeVisible();
  await page.getByLabel("Handoff reason").selectOption("high_intent");
  await page.getByRole("button", { name: "Take over" }).click();
  await expect(
    page.getByText("Conversation updated: taken-over."),
  ).toBeVisible();
  await expect(page.getByText("Human control · high_intent")).toBeVisible();

  await page
    .getByLabel("Reply as representative")
    .fill("Merhaba, demo icin size yardimci olacagim.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page
      .getByRole("list", { name: "Messages" })
      .getByText("Merhaba, demo icin size yardimci olacagim."),
  ).toBeVisible();
  await page.getByLabel("Add note").fill("Takvim tercihlerini sor.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Takvim tercihlerini sor.")).toBeVisible();
  await page.getByRole("button", { name: "Return to bot" }).click();
  await expect(page.getByText("Bot control")).toBeVisible();
  await expectAccessible(page);
});

test("inbox covers mobile, desktop, empty and action-error states", async ({
  page,
}) => {
  await mkdir("docs/evidence/P1.5/screenshots", { recursive: true });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `/app/inbox?conversation=${conversationId}&q=${encodeURIComponent(visitorMessage)}`,
    );
    await expect(
      page
        .getByRole("region", { name: "Conversations" })
        .locator(`a[href*="conversation=${conversationId}"]`),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expectAccessible(page);
    await page.screenshot({
      path: `docs/evidence/P1.5/screenshots/inbox-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(
    `/app/inbox?conversation=${conversationId}&error=ASSIGNMENT_CONFLICT`,
  );
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Refresh before retrying",
  );
  await page.goto("/app/inbox?q=no-conversation-can-match-this-query");
  await expect(
    page.getByRole("heading", { name: "Inbox is clear" }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({
    path: "docs/evidence/P1.5/screenshots/inbox-empty-375.png",
    fullPage: true,
  });
});
