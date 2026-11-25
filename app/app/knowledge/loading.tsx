import { PageContainer } from "@/components/layout/PageContainer";

export default function KnowledgeLoading() {
  return (
    <PageContainer width="wide" className="pt-8 pb-16 sm:pt-12">
      <div
        role="status"
        aria-label="Loading knowledge sources"
        className="animate-pulse"
      >
        <div className="bg-line h-10 w-72" />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border-line h-72 border" />
          ))}
        </div>
        <span className="sr-only">Loading knowledge sources…</span>
      </div>
    </PageContainer>
  );
}
