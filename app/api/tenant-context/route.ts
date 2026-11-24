import { NextResponse } from "next/server";

import { assertRequestedOrganization } from "@/lib/auth/authorization";
import { auditTenantDenial } from "@/lib/auth/audit-denial";
import { requireAuthorization } from "@/lib/auth/guard";
import {
  withApiObservability,
  type ApiRequest,
} from "@/lib/observability/api-route";

async function respond(api: ApiRequest, bodyOrganizationId?: string) {
  const authorization = await requireAuthorization();
  const { request } = api;
  const activeId = authorization.activeMembership.organization_id;
  const candidates = {
    query: request.nextUrl.searchParams.get("organizationId"),
    header: request.headers.get("x-organization-id"),
    cookie: request.cookies.get("organizationId")?.value,
    body: bodyOrganizationId,
  };
  for (const [source, candidate] of Object.entries(candidates)) {
    try {
      assertRequestedOrganization(candidate, activeId);
    } catch (error) {
      await auditTenantDenial(api, authorization, source);
      throw error;
    }
  }
  return NextResponse.json({ organization: authorization.activeMembership });
}

export const GET = withApiObservability("/api/tenant-context", (api) =>
  respond(api),
);

export const POST = withApiObservability("/api/tenant-context", async (api) => {
  const body = (await api.request.json().catch(() => ({}))) as {
    organizationId?: string;
  };
  return respond(api, body.organizationId);
});
