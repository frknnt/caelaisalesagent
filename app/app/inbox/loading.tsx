import { PageContainer } from "@/components/layout/PageContainer";

export default function InboxLoading() {
  return (
    <div aria-busy="true">
      <PageContainer width="wide" className="pt-6 pb-12">
        <span className="sr-only">Loading conversation inbox</span>
        <div className="h-20 animate-pulse rounded-card bg-fog motion-reduce:animate-none" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)_19rem]">
          {["queue", "transcript", "context"].map((name) => (
            <div
              key={name}
              className="h-[32rem] animate-pulse border border-line bg-mist motion-reduce:animate-none"
            />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
