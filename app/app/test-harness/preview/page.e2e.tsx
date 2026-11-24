import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

import { requireHarness } from "../harness-access";
import { PreviewConsole } from "../PreviewConsole";

export const metadata: Metadata = {
  title: "Test preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Stand-in for the preview screen (P1.6). Exists only in test builds. */
export default async function HarnessPreviewPage() {
  await requireHarness("/app/test-harness/preview");

  return (
    <PageContainer width="text" className="pt-8 pb-16 sm:pt-12">
      <Panel>
        <div className="rounded-card border-line bg-paper border p-5 sm:p-9">
          <Badge tone="amber">Test build only</Badge>
          <h1 className="display-md mt-4 font-normal">Test preview</h1>
          <PreviewConsole />
        </div>
      </Panel>
    </PageContainer>
  );
}
