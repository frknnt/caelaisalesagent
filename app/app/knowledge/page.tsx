import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requireAuthorization } from "@/lib/auth/guard";
import { isFreshSource } from "@/lib/knowledge/freshness";
import { createClient } from "@/lib/supabase/server";

import {
  addKnowledgeSource,
  reindexKnowledgeSource,
  retryKnowledgeJob,
  setKnowledgeSourceLifecycle,
} from "./actions";

export const metadata: Metadata = {
  title: "Knowledge sources",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const statusStyles = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  processing: "border-blue-300 bg-blue-50 text-blue-900",
  ready: "border-emerald-300 bg-emerald-50 text-emerald-900",
  failed: "border-red-300 bg-red-50 text-red-900",
} as const;

const statusStyle = (status: string) =>
  statusStyles[status as keyof typeof statusStyles] ?? statusStyles.pending;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requireAuthorization();
  const organizationId = context.activeMembership.organization_id;
  const client = await createClient();
  const [{ data: sites }, { data: sources }, { data: jobs }] =
    await Promise.all([
      client
        .from("sites")
        .select("id,name")
        .eq("organization_id", organizationId)
        .order("name"),
      client
        .from("knowledge_sources")
        .select(
          "id,name,source_type,status,progress,latest_error_code,updated_at,publication_status,freshness_checked_at,fresh_until,next_recrawl_at",
        )
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false }),
      client
        .from("ingestion_jobs")
        .select(
          "id,source_id,status,attempt_count,max_attempts,last_error_code",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
    ]);
  const latestJob = new Map((jobs ?? []).map((job) => [job.source_id, job]));
  const params = await searchParams;
  const notice = params.queued
    ? "Source queued for ingestion."
    : params.duplicate
      ? "This exact source already exists; no duplicate job was created."
      : params.retried
        ? "Failed job queued again safely."
        : params.reindexed
          ? "Source queued for a fresh index."
          : params.lifecycle
            ? `Source lifecycle changed to ${String(params.lifecycle)}.`
            : params.error
              ? `Source was not accepted (${String(params.error)}).`
              : null;
  const defaultSite = sites?.[0]?.id ?? "";

  return (
    <PageContainer width="wide" className="pt-8 pb-16 sm:pt-12">
      <header className="border-line mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-label text-muted">Workspace knowledge</p>
          <h1 className="display-md mt-2 font-normal">Knowledge sources</h1>
          <p className="text-body mt-3 max-w-2xl">
            Add approved site pages, URLs, text, FAQs, or private files.
            Extracted PII and price lines are flagged for review.
          </p>
        </div>
        <Link className="focus-ring text-link" href="/app">
          Back to workspace
        </Link>
      </header>

      {notice ? (
        <p role="status" className="border-line bg-paper mb-6 border px-4 py-3">
          {notice}
        </p>
      ) : null}

      <section
        aria-labelledby="add-source"
        className="grid gap-5 lg:grid-cols-3"
      >
        <h2 id="add-source" className="sr-only">
          Add a source
        </h2>
        <SourceForm
          title="Site or URL"
          defaultSite={defaultSite}
          sites={sites ?? []}
          kind="url"
        />
        <SourceForm
          title="Manual text or FAQ"
          defaultSite={defaultSite}
          sites={sites ?? []}
          kind="text"
        />
        <SourceForm
          title="Private file"
          defaultSite={defaultSite}
          sites={sites ?? []}
          kind="file"
        />
      </section>

      <section aria-labelledby="source-status" className="mt-12">
        <h2 id="source-status" className="display-sm font-normal">
          Ingestion status
        </h2>
        {!sources?.length ? (
          <div className="border-line mt-5 border p-8">
            <p className="text-body">No knowledge sources yet.</p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3">
            {sources.map((source) => {
              const job = latestJob.get(source.id);
              const isFresh = isFreshSource(source.status, source.fresh_until);
              return (
                <li
                  key={source.id}
                  className="border-line bg-paper grid gap-4 border p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-medium">{source.name}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${statusStyle(source.status)}`}
                      >
                        {source.status}
                      </span>
                      <span className="border-line bg-white rounded-full border px-2.5 py-1 text-xs font-semibold uppercase">
                        {source.publication_status}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${isFresh ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}
                      >
                        {isFresh ? "fresh" : "stale / unavailable"}
                      </span>
                    </div>
                    <p className="text-muted mt-2 text-sm">
                      {source.source_type} · {source.progress}% · attempt{" "}
                      {job?.attempt_count ?? 0}/{job?.max_attempts ?? 3}
                    </p>
                    {source.latest_error_code ? (
                      <p className="mt-2 text-sm text-red-800">
                        Error: {source.latest_error_code}
                      </p>
                    ) : null}
                    <p className="text-muted mt-2 text-sm">
                      Freshness checked:{" "}
                      {source.freshness_checked_at ?? "not yet"}
                      {source.fresh_until
                        ? ` · valid until ${source.fresh_until}`
                        : " · not retrievable"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {source.status === "failed" && job ? (
                      <form action={retryKnowledgeJob}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <SubmitButton
                          label="Retry safely"
                          pendingLabel="Queueing…"
                        />
                      </form>
                    ) : null}
                    {source.status === "ready" &&
                    source.publication_status !== "approved" &&
                    isFresh ? (
                      <LifecycleForm
                        sourceId={source.id}
                        status="approved"
                        label="Approve"
                      />
                    ) : null}
                    {source.publication_status === "approved" ? (
                      <LifecycleForm
                        sourceId={source.id}
                        status="disabled"
                        label="Disable"
                      />
                    ) : source.publication_status === "disabled" ? (
                      <LifecycleForm
                        sourceId={source.id}
                        status="draft"
                        label="Move to draft"
                      />
                    ) : null}
                    {source.status === "ready" &&
                    ["site", "url"].includes(source.source_type) ? (
                      <form action={reindexKnowledgeSource}>
                        <input
                          type="hidden"
                          name="sourceId"
                          value={source.id}
                        />
                        <SubmitButton
                          label="Reindex now"
                          pendingLabel="Queueing…"
                        />
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

function LifecycleForm({
  sourceId,
  status,
  label,
}: {
  sourceId: string;
  status: "draft" | "approved" | "disabled";
  label: string;
}) {
  return (
    <form action={setKnowledgeSourceLifecycle}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="publicationStatus" value={status} />
      <SubmitButton label={label} pendingLabel="Saving…" />
    </form>
  );
}

function SourceForm({
  title,
  sites,
  defaultSite,
  kind,
}: {
  title: string;
  sites: Array<{ id: string; name: string }>;
  defaultSite: string;
  kind: "url" | "text" | "file";
}) {
  const inputClass =
    "focus-ring border-line bg-white min-h-11 w-full border px-3 py-2";
  return (
    <form
      action={addKnowledgeSource}
      className="border-line bg-paper flex flex-col gap-4 border p-5"
    >
      <h3 className="text-lg font-medium">{title}</h3>
      <label className="grid gap-1 text-sm font-medium">
        Site
        <select
          className={inputClass}
          name="siteId"
          defaultValue={defaultSite}
          required
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Name
        <input
          className={inputClass}
          name="name"
          minLength={2}
          maxLength={160}
          required
        />
      </label>
      {kind === "url" ? (
        <>
          <label className="grid gap-1 text-sm font-medium">
            Type
            <select
              className={inputClass}
              name="sourceType"
              defaultValue="site"
            >
              <option value="site">Site crawl</option>
              <option value="url">Single URL</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            HTTPS URL
            <input
              className={inputClass}
              name="url"
              type="url"
              pattern="https://.*"
              required
            />
          </label>
        </>
      ) : null}
      {kind === "text" ? (
        <>
          <label className="grid gap-1 text-sm font-medium">
            Type
            <select
              className={inputClass}
              name="sourceType"
              defaultValue="manual"
            >
              <option value="manual">Manual text</option>
              <option value="faq">FAQ</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Content
            <textarea
              className={`${inputClass} min-h-32`}
              name="text"
              maxLength={1048576}
              required
            />
          </label>
        </>
      ) : null}
      {kind === "file" ? (
        <>
          <input type="hidden" name="sourceType" value="file" />
          <label className="grid gap-1 text-sm font-medium">
            PDF, DOCX, TXT, CSV, or XLSX
            <input
              className={inputClass}
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.csv,.xlsx"
              required
            />
          </label>
        </>
      ) : null}
      <SubmitButton label="Add source" pendingLabel="Validating…" />
    </form>
  );
}
