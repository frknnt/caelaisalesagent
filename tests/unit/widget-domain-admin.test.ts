import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/auth/authorization";
import { fixtureContext } from "@/lib/testing/fixtures";
import { createMemoryLogger } from "@/lib/testing/memory-sinks";
import { setSubdomains, verifyDomain } from "@/lib/widget/domain-admin";

const organizationId = "a0000000-0000-4000-8000-000000000001";
const domainId = "a0000000-0000-4000-8000-000000000201";
const token = "0123456789abcdef0123456789abcdef";

const state = vi.hoisted(() => ({
  role: "owner",
  domain: null as Record<string, unknown> | null,
  updateError: null as { code: string } | null,
  updatedRows: [{ id: "x" }] as unknown[],
  updates: [] as { values: unknown; filters: Record<string, unknown> }[],
  reads: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuthorization: async () => ({
    user: { id: "a1111111-1111-4111-8111-111111111111" },
    activeMembership: { organization_id: organizationId, role: state.role },
  }),
}));

vi.mock("@/lib/observability/supabase-sinks", () => ({
  supabaseAuditSink: {
    record: async (event: Record<string, unknown>) => {
      state.audits.push(event);
    },
  },
}));

// Records the filters, because they are the tenant boundary of this code.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      const query = {
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => {
          state.reads.push(filters);
          const found =
            filters.organization_id === organizationId &&
            filters.id === domainId;
          return { data: found ? state.domain : null, error: null };
        },
        select: async () =>
          state.updateError
            ? { data: null, error: state.updateError }
            : { data: state.updatedRows, error: null },
      };
      return {
        select: () => query,
        update: (values: unknown) => {
          state.updates.push({ values, filters });
          return query;
        },
      };
    },
  }),
}));

function api(headers: Record<string, string> = {}, body: unknown = {}) {
  return {
    request: new NextRequest("http://localhost:3000/api/domains/x", {
      method: "POST",
      headers: { origin: "http://localhost:3000", ...headers },
      body: JSON.stringify(body),
    }),
    context: fixtureContext,
    logger: createMemoryLogger().logger,
  };
}

const proven = { txt: async () => [`cael-site-verification=${token}`] };
const unproven = { txt: async () => [] };

const domain = (change: Record<string, unknown> = {}) => ({
  id: domainId,
  hostname: "shop-a.com",
  environment: "production",
  verification_token: token,
  verification_method: null,
  ...change,
});

beforeEach(() => {
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  Object.assign(state, {
    role: "owner",
    domain: domain(),
    updateError: null,
    updatedRows: [{ id: domainId }],
    updates: [],
    reads: [],
    audits: [],
  });
});

const denied = (pending: Promise<unknown>) =>
  expect(pending).rejects.toEqual(
    new AuthorizationError(403, "PERMISSION_DENIED"),
  );

describe("domain verification", () => {
  it.each(["owner", "admin"])(
    "opens a proven domain for an %s",
    async (role) => {
      state.role = role;
      const response = await verifyDomain(api(), domainId, proven);
      expect(response.status).toBe(200);
      expect(state.updates).toEqual([
        {
          values: {
            verified_at: expect.any(String),
            verification_method: "dns_txt",
          },
          filters: {
            id: domainId,
            organization_id: organizationId,
            verification_token: token,
          },
        },
      ]);
      expect(state.audits).toMatchObject([
        {
          action: "domain.verification_requested",
          outcome: "success",
          organizationId,
          entityId: domainId,
          actor: { type: "user" },
        },
      ]);
    },
  );

  it("changes nothing without proof, and says so in the audit trail", async () => {
    const response = await verifyDomain(api(), domainId, unproven);
    expect(response.status).toBe(422);
    expect(state.updates).toEqual([]);
    expect(state.audits).toMatchObject([
      { action: "domain.verification_requested", outcome: "failure" },
    ]);
  });

  it("does not verify a preview domain", async () => {
    state.domain = domain({ environment: "preview" });
    const response = await verifyDomain(api(), domainId, proven);
    expect(response.status).toBe(422);
    expect(state.updates).toEqual([]);
  });

  it("does not take over a name that is verified elsewhere", async () => {
    state.updateError = { code: "23505" };
    const response = await verifyDomain(api(), domainId, proven);
    expect(response.status).toBe(409);
    expect(state.audits).toMatchObject([
      { outcome: "failure", metadata: { reason: "conflict" } },
    ]);
  });

  it("does not report success for a row that changed meanwhile", async () => {
    state.updatedRows = [];
    expect((await verifyDomain(api(), domainId, proven)).status).toBe(409);
  });

  it.each(["editor", "sales", "viewer"])("is refused for %s", async (role) => {
    state.role = role;
    await denied(verifyDomain(api(), domainId, proven));
    expect(state.reads).toEqual([]);
    expect(state.updates).toEqual([]);
    expect(state.audits).toMatchObject([
      { action: "tenant.access_denied", outcome: "denied" },
    ]);
  });

  it("is refused for a domain of another tenant like for a missing one", async () => {
    await denied(
      verifyDomain(api(), "b0000000-0000-4000-8000-000000000201", proven),
    );
    await denied(verifyDomain(api(), "not-an-id", proven));
    expect(state.reads).toEqual([
      {
        id: "b0000000-0000-4000-8000-000000000201",
        organization_id: organizationId,
      },
    ]);
    expect(state.updates).toEqual([]);
  });

  it.each<[string, Record<string, string>]>([
    ["another page", { origin: "https://evil.example" }],
    ["a page without an origin", { origin: "null" }],
    ["a same-site sibling", { "sec-fetch-site": "same-site" }],
  ])("is refused when %s sends it", async (_, headers) => {
    await denied(verifyDomain(api(headers), domainId, proven));
    expect(state.reads).toEqual([]);
  });
});

describe("subdomains", () => {
  const verified = () => domain({ verification_method: "dns_txt" });

  it("open and close for a verified name", async () => {
    state.domain = verified();
    for (const allow of [true, false]) {
      const response = await setSubdomains(api({}, { allow }), domainId);
      expect(await response.json()).toEqual({ allowSubdomains: allow });
    }
    expect(state.updates).toEqual([
      {
        values: { allow_subdomains: true },
        filters: { id: domainId, organization_id: organizationId },
      },
      {
        values: { allow_subdomains: false },
        filters: { id: domainId, organization_id: organizationId },
      },
    ]);
  });

  it.each(["vercel.app", "com.tr", "myshopify.com", "unknown.invalid"])(
    "never open for %s, even when it is marked verified",
    async (hostname) => {
      state.domain = domain({ hostname, verification_method: "operator" });
      const response = await setSubdomains(api({}, { allow: true }), domainId);
      expect(response.status).toBe(422);
      expect(state.updates).toEqual([]);
    },
  );

  it("do not open before the name is proven", async () => {
    const response = await setSubdomains(api({}, { allow: true }), domainId);
    expect(response.status).toBe(422);
    expect(state.updates).toEqual([]);
  });

  it.each([null, {}, { allow: "true" }, { allow: 1 }])(
    "refuse the body %j",
    async (body) => {
      state.domain = verified();
      expect((await setSubdomains(api({}, body), domainId)).status).toBe(400);
      expect(state.updates).toEqual([]);
    },
  );

  it.each(["editor", "sales", "viewer"])("are refused for %s", async (role) => {
    state.role = role;
    state.domain = verified();
    await denied(setSubdomains(api({}, { allow: true }), domainId));
    expect(state.updates).toEqual([]);
  });
});
