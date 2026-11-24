import { withApiObservability } from "@/lib/observability/api-route";
import { setSubdomains } from "@/lib/widget/domain-admin";

interface RouteContext {
  params: Promise<{ domainId: string }>;
}

export const POST = withApiObservability(
  "/api/domains/[domainId]/subdomains",
  async (api, { params }: RouteContext) =>
    setSubdomains(api, (await params).domainId),
);
