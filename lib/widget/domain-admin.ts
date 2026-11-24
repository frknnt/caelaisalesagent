import "server-only";

import { NextResponse } from "next/server";

import { auditTenantDenial } from "@/lib/auth/audit-denial";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireAuthorization } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/auth/same-origin";
import { readRuntimeConfig } from "@/lib/env";
import type { ApiRequest } from "@/lib/observability/api-route";
import { recordAudit } from "@/lib/observability/audit";
import { supabaseAuditSink } from "@/lib/observability/supabase-sinks";
import { createAdminClient } from "@/lib/supabase/admin";

import { isDomainProven, type DnsPort } from "./domain-verification";
import { canAllowSubdomains } from "./origin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const failure = (status: number, code: string, requestId: string) =>
  NextResponse.json({ error: { code, requestId } }, { status });

/**
 * The domain a signed-in owner or admin may manage. A missing id and another
 * tenant's id are refused the same way.
 */
async function requireManagedDomain(api: ApiRequest, domainId: string) {
  const runtime = readRuntimeConfig(process.env, process.env.NODE_ENV);
  if (!runtime.ok) throw new Error(runtime.error.code);
  assertSameOrigin(api.request.headers, runtime.value.appBaseUrl);

  const authorization = await requireAuthorization();
  const { activeMembership, user } = authorization;
  const permitted = hasPermission(activeMembership.role, "organization:update");
  const { data: domain, error } =
    permitted && uuidPattern.test(domainId)
      ? await createAdminClient()
          .from("domains")
          .select(
            "id, hostname, environment, verification_token, verification_method",
          )
          .eq("id", domainId)
          // Service role bypasses RLS: this is the tenant boundary here.
          .eq("organization_id", activeMembership.organization_id)
          .maybeSingle()
      : { data: null, error: null };
  if (error) throw error;
  if (!domain) {
    await auditTenantDenial(api, authorization, "path");
    throw new AuthorizationError(403, "PERMISSION_DENIED");
  }
  const organizationId = activeMembership.organization_id;
  const audit = (
    action: string,
    outcome: "success" | "failure",
    metadata: Record<string, string | boolean> = {},
  ) =>
    recordAudit(
      supabaseAuditSink,
      {
        organizationId,
        actor: { type: "user", userId: user.id },
        action,
        entityType: "domain",
        entityId: domain.id,
        outcome,
        context: api.context,
        metadata,
      },
      api.logger,
    );
  return { domain, organizationId, audit };
}

/** Checks the DNS challenge and opens the domain. */
export async function verifyDomain(
  api: ApiRequest,
  domainId: string,
  dns: DnsPort,
) {
  const { domain, organizationId, audit } = await requireManagedDomain(
    api,
    domainId,
  );
  const { requestId } = api.context;
  if (domain.environment !== "production") {
    return failure(422, "PREVIEW_DOMAIN_IS_NOT_VERIFIED", requestId);
  }
  if (
    !(await isDomainProven(dns, domain.hostname, domain.verification_token))
  ) {
    await audit("domain.verification_requested", "failure");
    return failure(422, "DOMAIN_CHALLENGE_NOT_FOUND", requestId);
  }
  const { data, error } = await createAdminClient()
    .from("domains")
    .update({
      verified_at: new Date().toISOString(),
      verification_method: "dns_txt",
    })
    .eq("id", domain.id)
    .eq("organization_id", organizationId)
    // Exactly the challenge that was proven.
    .eq("verification_token", domain.verification_token)
    .select("id");
  if (error?.code === "23505") {
    await audit("domain.verification_requested", "failure", {
      reason: "conflict",
    });
    return failure(409, "DOMAIN_ALREADY_VERIFIED", requestId);
  }
  if (error) throw error;
  if (data.length === 0) return failure(409, "DOMAIN_CHANGED", requestId);
  await audit("domain.verification_requested", "success");
  return NextResponse.json({ status: "verified" });
}

/** Opens or closes one label below a verified domain. */
export async function setSubdomains(api: ApiRequest, domainId: string) {
  const { domain, organizationId, audit } = await requireManagedDomain(
    api,
    domainId,
  );
  const { requestId } = api.context;
  const body: unknown = await api.request.json().catch(() => null);
  const allow = (body as { allow?: unknown } | null)?.allow;
  if (typeof allow !== "boolean") {
    return failure(400, "INVALID_REQUEST", requestId);
  }
  if (allow && !canAllowSubdomains(domain.hostname)) {
    await audit("domain.subdomains_requested", "failure", {
      reason: "public_suffix",
    });
    return failure(422, "PUBLIC_SUFFIX", requestId);
  }
  if (allow && domain.verification_method === null) {
    return failure(422, "DOMAIN_NOT_VERIFIED", requestId);
  }
  const { data, error } = await createAdminClient()
    .from("domains")
    .update({ allow_subdomains: allow })
    .eq("id", domain.id)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) throw error;
  if (data.length === 0) return failure(409, "DOMAIN_CHANGED", requestId);
  await audit("domain.subdomains_requested", "success", { allowed: allow });
  return NextResponse.json({ allowSubdomains: allow });
}
