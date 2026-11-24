import { withApiObservability } from "@/lib/observability/api-route";
import { verifyDomain } from "@/lib/widget/domain-admin";
import { systemDns } from "@/lib/widget/domain-verification";

interface RouteContext {
  params: Promise<{ domainId: string }>;
}

export const POST = withApiObservability(
  "/api/domains/[domainId]/verification",
  async (api, { params }: RouteContext) =>
    verifyDomain(api, (await params).domainId, systemDns),
);
