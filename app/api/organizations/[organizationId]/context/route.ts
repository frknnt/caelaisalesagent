import { NextResponse } from "next/server";

import { assertRequestedOrganization } from "@/lib/auth/authorization";
import { auditTenantDenial } from "@/lib/auth/audit-denial";
import { requireAuthorization } from "@/lib/auth/guard";
import { withApiObservability } from "@/lib/observability/api-route";

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

export const GET = withApiObservability(
  "/api/organizations/[organizationId]/context",
  async (api, { params }: RouteContext) => {
    const authorization = await requireAuthorization();
    const { organizationId } = await params;
    try {
      assertRequestedOrganization(
        organizationId,
        authorization.activeMembership.organization_id,
      );
    } catch (error) {
      await auditTenantDenial(api, authorization, "path");
      throw error;
    }
    return NextResponse.json({ organization: authorization.activeMembership });
  },
);
