import { PageContainer } from "@/components/layout/PageContainer";

export default function HarnessPreviewLoading() {
  return (
    <PageContainer width="text" className="pt-8 pb-16 sm:pt-12">
      <p role="status" className="text-body text-[1.0625rem]">
        Loading the preview…
      </p>
    </PageContainer>
  );
}
