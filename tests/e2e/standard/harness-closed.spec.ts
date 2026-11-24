import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { e2eServers } from "../../../scripts/e2e-environment.mjs";
import { expect, signIn, test } from "../support";

// This server runs the ordinary production build. The run-time flag is set on
// purpose: the harness must stay closed even then.

function filesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

const harnessMarkers = [
  "test-harness",
  "fake-model-1",
  "harness_preview",
  "HARNESS_CRASH",
];

function markersIn(distDir: string) {
  const built = ["server", "static"].flatMap((part) =>
    filesIn(join(distDir, part)),
  );
  const text = built
    .filter((path) => /\.(js|json|html|rsc)$/.test(path))
    .map((path) => readFileSync(path, "utf8"));
  return harnessMarkers.filter((marker) =>
    text.some((content) => content.includes(marker)),
  );
}

test("harness routes are 404 for a signed-in owner of the standard build", async ({
  page,
}) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tenant A Internal" }),
  ).toBeVisible();

  for (const path of ["/app/test-harness", "/app/test-harness/preview"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("harness routes ask a signed-out visitor to sign in, like any /app path", async ({
  page,
}) => {
  await page.goto("/app/test-harness");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("the proxy covers paths without a file extension and skips real files", async ({
  page,
  request,
}) => {
  await page.goto("/app/xpng");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fxpng$/);

  const clientId = "f0000000-0000-4000-8000-000000000009";
  const headers = { "x-request-id": clientId };
  const covered = await request.get("/api/foosvg", { headers });
  expect(covered.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  expect(covered.headers()["x-request-id"]).not.toBe(clientId);

  const file = await request.get("/icon.svg", { headers });
  expect(file.status()).toBe(200);
  expect(file.headers()["x-request-id"]).toBeUndefined();
});

test("the standard build contains no harness code", () => {
  expect(markersIn(e2eServers.standard.distDir)).toEqual([]);
  // The same search finds every marker in the harness build.
  expect(markersIn(e2eServers.harness.distDir)).toEqual(harnessMarkers);
});

test("no server secret is in a file the browser can download", () => {
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  expect(secret.length).toBeGreaterThan(20);
  for (const { distDir } of Object.values(e2eServers)) {
    const leaks = filesIn(join(distDir, "static")).filter((path) =>
      readFileSync(path, "utf8").includes(secret),
    );
    expect(leaks).toEqual([]);
  }
});
