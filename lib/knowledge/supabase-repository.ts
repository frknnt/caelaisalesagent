import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { IngestionError } from "./types";
import type {
  BinarySource,
  ClaimedJob,
  ExtractedDocument,
  PreparedChunk,
  WorkerRepository,
} from "./types";

export class SupabaseWorkerRepository implements WorkerRepository {
  private readonly client = createAdminClient();

  async claim(): Promise<ClaimedJob | null> {
    const { data, error } = await this.client.rpc("claim_ingestion_job", {
      p_visibility_seconds: 120,
    });
    if (error) throw new IngestionError("QUEUE_CLAIM_FAILED", true);
    const row = data?.[0];
    if (!row) return null;
    return {
      messageId: row.message_id,
      jobId: row.job_id,
      organizationId: row.organization_id,
      siteId: row.site_id,
      sourceId: row.source_id,
      versionId: row.version_id,
      sourceType: row.source_type as ClaimedJob["sourceType"],
      canonicalUrl: row.canonical_url,
      inputText: row.input_text,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
    };
  }

  async loadFile(job: ClaimedJob): Promise<BinarySource> {
    const { data, error } = await this.client
      .from("documents")
      .select("storage_bucket,storage_path,title,mime_type")
      .eq("organization_id", job.organizationId)
      .eq("version_id", job.versionId)
      .not("storage_path", "is", null)
      .maybeSingle();
    if (error || !data?.storage_bucket || !data.storage_path)
      throw new IngestionError("SOURCE_FILE_MISSING", false);
    const download = await this.client.storage
      .from(data.storage_bucket)
      .download(data.storage_path);
    if (download.error)
      throw new IngestionError("SOURCE_FILE_DOWNLOAD_FAILED", true);
    return {
      bytes: new Uint8Array(await download.data.arrayBuffer()),
      fileName: data.title,
      declaredMimeType: data.mime_type,
    };
  }

  async allowedHosts(job: ClaimedJob) {
    const { data, error } = await this.client
      .from("domains")
      .select("hostname")
      .eq("organization_id", job.organizationId)
      .eq("site_id", job.siteId)
      .not("verified_at", "is", null);
    if (error) throw new IngestionError("ALLOWLIST_LOOKUP_FAILED", true);
    return (data ?? []).map((row) => row.hostname);
  }

  async setProgress(jobId: string, progress: number) {
    const { error } = await this.client.rpc("update_ingestion_progress", {
      p_job_id: jobId,
      p_progress: progress,
    });
    if (error) throw new IngestionError("PROGRESS_UPDATE_FAILED", true);
  }

  async replaceDocuments(
    job: ClaimedJob,
    documents: ExtractedDocument[],
    chunks: PreparedChunk[][],
    malwareStatus: "not_required" | "clean",
  ) {
    const { data: rawFile } = await this.client
      .from("documents")
      .select("storage_bucket,storage_path,raw_retention_until")
      .eq("organization_id", job.organizationId)
      .eq("version_id", job.versionId)
      .not("storage_path", "is", null)
      .maybeSingle();
    const { error: deleteError } = await this.client
      .from("documents")
      .delete()
      .eq("organization_id", job.organizationId)
      .eq("version_id", job.versionId);
    if (deleteError) throw new IngestionError("DOCUMENT_REPLACE_FAILED", true);

    for (const [index, document] of documents.entries()) {
      const preserveRaw = index === 0 && rawFile?.storage_path;
      const { data: inserted, error } = await this.client
        .from("documents")
        .insert({
          organization_id: job.organizationId,
          site_id: job.siteId,
          source_id: job.sourceId,
          version_id: job.versionId,
          title: document.title,
          canonical_url: document.canonicalUrl ?? null,
          mime_type: document.mimeType,
          byte_size: document.byteSize,
          content_sha256: document.contentSha256,
          malware_status: malwareStatus,
          storage_bucket: preserveRaw ? rawFile.storage_bucket : null,
          storage_path: preserveRaw ? rawFile.storage_path : null,
          raw_retention_until: preserveRaw ? rawFile.raw_retention_until : null,
        })
        .select("id")
        .single();
      if (error) throw new IngestionError("DOCUMENT_PERSIST_FAILED", true);
      const rows = (chunks[index] ?? []).map((chunk) => ({
        organization_id: job.organizationId,
        site_id: job.siteId,
        source_id: job.sourceId,
        version_id: job.versionId,
        document_id: inserted.id,
        ordinal: chunk.ordinal,
        content: chunk.content,
        content_sha256: chunk.contentSha256,
        pii_types: chunk.piiTypes,
        has_price: chunk.hasPrice,
        price_line_numbers: chunk.priceLineNumbers,
      }));
      if (rows.length) {
        const { error: chunkError } = await this.client
          .from("chunks")
          .insert(rows);
        if (chunkError) throw new IngestionError("CHUNK_PERSIST_FAILED", true);
      }
    }
  }

  async complete(job: ClaimedJob) {
    const { error } = await this.client.rpc("complete_ingestion_job", {
      p_job_id: job.jobId,
      p_message_id: job.messageId,
    });
    if (error) throw new IngestionError("JOB_COMPLETE_FAILED", true);
  }

  async fail(job: ClaimedJob, failure: IngestionError) {
    const { error } = await this.client.rpc("fail_ingestion_job", {
      p_job_id: job.jobId,
      p_message_id: job.messageId,
      p_error_code: failure.code,
      p_retryable: failure.retryable,
      p_retry_delay_seconds: Math.min(30 * 2 ** (job.attemptCount - 1), 3600),
    });
    if (error) throw new IngestionError("JOB_FAILURE_RECORD_FAILED", true);
  }
}
