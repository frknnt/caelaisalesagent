import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";

import type { Database } from "../../../db/database.types";
import { hostUrl, serverUrl } from "../../../scripts/e2e-environment.mjs";
import { expect, localDatabase, seedPassword, test as base } from "../support";

export const appUrl = serverUrl("standard");
export const siteA = "a0000000-0000-4000-8000-000000000101";
export const siteB = "b0000000-0000-4000-8000-000000000101";
const tenantA = "a0000000-0000-4000-8000-000000000001";
const tenantB = "b0000000-0000-4000-8000-000000000001";

export const handoffUrl = "https://shop-a.example/contact";

export interface WidgetKeys {
  a: string;
  aId: string;
  aPreview: string;
  b: string;
}

/** A signed-in client, so keys are made the way an owner makes them. */
async function signedIn(email: string) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: seedPassword,
  });
  if (error) throw error;
  return client;
}

async function check<Result extends { error: unknown }>(
  pending: PromiseLike<Result>,
) {
  const result = await pending;
  if (result.error) throw new Error(JSON.stringify(result.error));
  return result;
}

const testHosts = [
  "shop-a.localhost",
  "wild-a.localhost",
  "unverified-a.localhost",
  "preview-a.localhost",
  "shop-b.localhost",
];

async function removeFixtures() {
  const admin = localDatabase();
  await check(admin.from("domains").delete().in("hostname", testHosts));
  for (const email of ["owner-a@example.test", "owner-b@example.test"]) {
    const owner = await signedIn(email);
    const { data } = await check(
      owner.from("site_keys").select("id").is("revoked_at", null),
    );
    for (const { id } of data ?? []) {
      await check(owner.rpc("revoke_site_key", { p_key_id: id }));
    }
    await owner.auth.signOut({ scope: "local" });
  }
}

/** Sites, hosts and keys of the widget tests. Local stack only. */
export async function createFixtures(): Promise<WidgetKeys> {
  await removeFixtures();
  const admin = localDatabase();
  const verified = {
    verified_at: new Date().toISOString(),
    verification_method: "dns_txt",
  };
  await check(
    admin.from("domains").insert([
      {
        organization_id: tenantA,
        site_id: siteA,
        hostname: "shop-a.localhost",
        allow_subdomains: false,
        ...verified,
      },
      {
        organization_id: tenantA,
        site_id: siteA,
        hostname: "wild-a.localhost",
        allow_subdomains: true,
        ...verified,
      },
      {
        organization_id: tenantB,
        site_id: siteB,
        hostname: "shop-b.localhost",
        allow_subdomains: false,
        ...verified,
      },
    ]),
  );
  await check(
    admin
      .from("sites")
      .update({ widget_accent_color: "#0b7188", handoff_url: handoffUrl })
      .eq("id", siteA),
  );

  const ownerA = await signedIn("owner-a@example.test");
  await check(
    ownerA.from("domains").insert({
      organization_id: tenantA,
      site_id: siteA,
      hostname: "unverified-a.localhost",
    }),
  );
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await check(
    ownerA.rpc("add_preview_domain", {
      p_site_id: siteA,
      p_hostname: "preview-a.localhost",
      p_expires_at: tomorrow,
    }),
  );
  const keyA = await check(
    ownerA.rpc("create_site_key", {
      p_site_id: siteA,
      p_environment: "production",
    }),
  );
  const previewA = await check(
    ownerA.rpc("create_site_key", {
      p_site_id: siteA,
      p_environment: "preview",
      p_expires_at: tomorrow,
    }),
  );
  const ownerB = await signedIn("owner-b@example.test");
  const keyB = await check(
    ownerB.rpc("create_site_key", {
      p_site_id: siteB,
      p_environment: "production",
    }),
  );
  return {
    a: keyA.data?.public_key ?? "",
    aId: keyA.data?.id ?? "",
    aPreview: previewA.data?.public_key ?? "",
    b: keyB.data?.public_key ?? "",
  };
}

export async function revokeKey(id: string) {
  const owner = await signedIn("owner-a@example.test");
  await check(owner.rpc("revoke_site_key", { p_key_id: id }));
}

export async function createKeyA() {
  const owner = await signedIn("owner-a@example.test");
  const { data } = await check(
    owner.rpc("create_site_key", {
      p_site_id: siteA,
      p_environment: "production",
    }),
  );
  return { id: data?.id ?? "", key: data?.public_key ?? "" };
}

let nextAddress = Math.floor(Math.random() * 60_000);

/** Each test is its own visitor, so one test's requests never limit another. */
export function visitorAddress() {
  nextAddress += 1;
  return `198.18.${Math.floor(nextAddress / 250) % 250}.${(nextAddress % 250) + 1}`;
}

export const test = base.extend<object, { keys: WidgetKeys }>({
  keys: [
    async ({}, provide) => {
      const keys = await createFixtures();
      await provide(keys);
      await removeFixtures();
    },
    { scope: "worker" },
  ],
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-real-ip": visitorAddress() });
  },
});

export { expect };

export function hostPage(name: string, query: Record<string, string> = {}) {
  return `${hostUrl(name)}/?${new URLSearchParams(query)}`;
}

export const launcher = (page: Page) =>
  page.locator("cael-widget button.launcher");
export const panel = (page: Page) => page.locator("cael-widget .panel");
export const frame = (page: Page) => page.frameLocator("cael-widget iframe");

export async function openWidget(page: Page) {
  await launcher(page).click();
  await expect(frame(page).locator("#state")).toHaveAttribute(
    "data-state",
    "ready",
  );
}

/** The page is exactly as usable as without the widget. */
export async function expectHostUnharmed(page: Page) {
  expect(
    await page.evaluate(
      () => (window as unknown as { hostErrors: string[] }).hostErrors,
    ),
  ).toEqual([]);
  await expect(page.locator("#content")).toBeVisible();
  await page.locator("#buy").click();
  await expect(page.locator("#buy")).toHaveText("Added");
}

export async function expectNoWidget(page: Page) {
  // Give a late answer the chance to do the wrong thing.
  await page.waitForTimeout(400);
  await expect(page.locator("cael-widget")).toHaveCount(0);
  expect(page.frames()).toHaveLength(1);
  await expectHostUnharmed(page);
}

export async function appCookies(context: BrowserContext) {
  return (await context.cookies()).map(({ name }) => name);
}
