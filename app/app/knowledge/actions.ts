"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthorization } from "@/lib/auth/guard";
import { canonicalSourceKey, sha256 } from "@/lib/knowledge/hash";
import { validateFile } from "@/lib/knowledge/file-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const safeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "source";

const fail = (code: string): never =>
  redirect(`/app/knowledge?error=${encodeURIComponent(code)}`);

async function assertSite(organizationId: string, siteId: string) {
  const client = await createClient();
  const { data } = await client
    .from("sites")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", siteId)
    .maybeSingle();
  if (!data) fail("SITE_NOT_FOUND");
}

export async function addKnowledgeSource(formData: FormData) {
  const context = await requireAuthorization("knowledge:manage");
  const organizationId = context.activeMembership.organization_id;
  const siteId = String(formData.get("siteId") ?? "");
  const sourceType = String(formData.get("sourceType") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!siteId || !name || name.length < 2 || name.length > 160)
    fail("INVALID_SOURCE");
  await assertSite(organizationId, siteId);

  let sourceKey = "";
  let contentHash = "";
  let canonicalUrl: string | null = null;
  let inputText: string | null = null;
  let validatedFile: Awaited<ReturnType<typeof validateFile>> | null = null;

  if (sourceType === "manual" || sourceType === "faq") {
    inputText = String(formData.get("text") ?? "").trim();
    if (!inputText || Buffer.byteLength(inputText) > 1_048_576)
      fail("INVALID_SOURCE_TEXT");
    contentHash = sha256(inputText);
    sourceKey = canonicalSourceKey(`${sourceType}:${contentHash}`);
  } else if (sourceType === "site" || sourceType === "url") {
    try {
      const url = new URL(String(formData.get("url") ?? ""));
      if (url.protocol !== "https:" || url.username || url.password)
        fail("INVALID_SOURCE_URL");
      url.hash = "";
      canonicalUrl = url.toString();
    } catch {
      fail("INVALID_SOURCE_URL");
    }
    if (!canonicalUrl) return fail("INVALID_SOURCE_URL");
    const canonicalUrlValue = canonicalUrl;
    const client = await createClient();
    const { data: domain } = await client
      .from("domains")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("site_id", siteId)
      .eq("hostname", new URL(canonicalUrlValue).hostname.toLowerCase())
      .not("verified_at", "is", null)
      .maybeSingle();
    if (!domain) fail("SOURCE_HOST_NOT_ALLOWED");
    contentHash = sha256(canonicalUrlValue);
    sourceKey = canonicalSourceKey(`${sourceType}:${canonicalUrlValue}`);
  } else if (sourceType === "file") {
    const file = formData.get("file");
    if (!file || typeof file === "string") return fail("FILE_REQUIRED");
    try {
      const validated = await validateFile({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        declaredMimeType: file.type,
      });
      validatedFile = validated;
      sourceKey = canonicalSourceKey(`file:${validated.sha256}`);
      contentHash = validated.sha256;
    } catch (error) {
      fail(error instanceof Error ? error.message : "INVALID_FILE");
    }
  } else fail("INVALID_SOURCE_TYPE");

  const client = await createClient();
  const { data, error } = await client.rpc("enqueue_knowledge_source", {
    p_organization_id: organizationId,
    p_site_id: siteId,
    p_source_type: sourceType,
    p_name: name,
    p_source_key: sourceKey,
    p_content_sha256: contentHash,
    p_max_attempts: 3,
    ...(canonicalUrl === null ? {} : { p_canonical_url: canonicalUrl }),
    ...(inputText === null ? {} : { p_input_text: inputText }),
  });
  const queued = data?.[0];
  if (error || !queued) return fail("SOURCE_ENQUEUE_FAILED");
  const queuedSource = queued;

  if (validatedFile && !queuedSource.is_duplicate) {
    const admin = createAdminClient();
    const storagePath = `${organizationId}/${siteId}/${validatedFile.sha256}/${safeName(validatedFile.fileName)}`;
    const uploaded = await admin.storage
      .from("knowledge-sources")
      .upload(storagePath, validatedFile.bytes, {
        contentType: validatedFile.mimeType,
        upsert: false,
      });
    if (
      uploaded.error &&
      !/already exists|duplicate/i.test(uploaded.error.message)
    )
      fail("SOURCE_UPLOAD_FAILED");
    const { error: documentError } = await admin.from("documents").insert({
      organization_id: organizationId,
      site_id: siteId,
      source_id: queuedSource.source_id,
      version_id: queuedSource.version_id,
      title: validatedFile.fileName.slice(0, 300),
      mime_type: validatedFile.mimeType,
      byte_size: validatedFile.bytes.byteLength,
      content_sha256: validatedFile.sha256,
      storage_bucket: "knowledge-sources",
      storage_path: storagePath,
      malware_status: "pending",
      raw_retention_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    if (documentError) fail("SOURCE_DOCUMENT_FAILED");
  }

  revalidatePath("/app/knowledge");
  redirect(
    queuedSource.is_duplicate
      ? "/app/knowledge?duplicate=1"
      : "/app/knowledge?queued=1",
  );
}

export async function retryKnowledgeJob(formData: FormData) {
  await requireAuthorization("knowledge:manage");
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) fail("JOB_REQUIRED");
  const client = await createClient();
  const { error } = await client.rpc("retry_ingestion_job", {
    p_job_id: jobId,
  });
  if (error) fail("JOB_RETRY_FAILED");
  revalidatePath("/app/knowledge");
  redirect("/app/knowledge?retried=1");
}
