import { lookup } from "node:dns/promises";

import { chunkDocument } from "./chunking";
import { crawlSite, type CrawlDependencies } from "./crawler";
import { extractFile } from "./extractors";
import { createEmbeddingProvider } from "./embeddings";
import { sha256 } from "./hash";
import { validateFile } from "./file-validation";
import {
  IngestionError,
  type ExtractedDocument,
  type MalwareScanner,
  type WorkerRepository,
} from "./types";

const defaultCrawlDependencies: CrawlDependencies = {
  fetch,
  resolve: async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map(
      (entry) => entry.address,
    ),
};

export class IngestionWorker {
  constructor(
    private readonly repository: WorkerRepository,
    private readonly malwareScanner: MalwareScanner,
    private readonly crawlDependencies = defaultCrawlDependencies,
    private readonly embeddingProvider = createEmbeddingProvider(),
  ) {}

  async processNext() {
    const job = await this.repository.claim();
    if (!job) return false;
    try {
      await this.repository.setProgress(job.jobId, 15);
      let documents: ExtractedDocument[];
      let malwareStatus: "not_required" | "clean" = "not_required";
      if (job.sourceType === "file") {
        const file = await validateFile(await this.repository.loadFile(job));
        const scan = await this.malwareScanner.scan(file);
        if (scan === "infected")
          throw new IngestionError("MALWARE_DETECTED", false);
        malwareStatus = "clean";
        await this.repository.setProgress(job.jobId, 40);
        documents = await extractFile(file);
      } else if (job.sourceType === "site" || job.sourceType === "url") {
        if (!job.canonicalUrl)
          throw new IngestionError("SOURCE_URL_MISSING", false);
        documents = await crawlSite(
          job.canonicalUrl,
          await this.repository.allowedHosts(job),
          this.crawlDependencies,
          job.sourceType === "url"
            ? { maxPages: 1, maxDepth: 0, maxBytesPerPage: 2_000_000 }
            : undefined,
        );
      } else {
        const text = job.inputText?.trim();
        if (!text) throw new IngestionError("SOURCE_TEXT_MISSING", false);
        documents = [
          {
            title: job.sourceType === "faq" ? "FAQ" : "Manual text",
            text,
            mimeType: "text/plain",
            byteSize: Buffer.byteLength(text),
            contentSha256: sha256(text),
          },
        ];
      }
      await this.repository.setProgress(job.jobId, 70);
      const chunks = documents.map((document) => chunkDocument(document.text));
      const flattened = chunks.flat();
      const embeddings = await this.embeddingProvider.embed(
        flattened.map((chunk) => chunk.content),
      );
      flattened.forEach((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding)
          throw new IngestionError("EMBEDDING_INVALID_RESPONSE", true);
        chunk.embedding = embedding;
        chunk.embeddingModel = this.embeddingProvider.model;
      });
      await this.repository.replaceDocuments(
        job,
        documents,
        chunks,
        malwareStatus,
      );
      await this.repository.setProgress(job.jobId, 95);
      await this.repository.complete(job);
      return true;
    } catch (error) {
      const safeError =
        error instanceof IngestionError
          ? error
          : new IngestionError("INGESTION_INTERNAL_ERROR", true);
      await this.repository.fail(job, safeError);
      return true;
    }
  }
}

export class WebhookMalwareScanner implements MalwareScanner {
  constructor(
    private readonly endpoint: string | undefined,
    private readonly token: string | undefined,
    private readonly request: typeof fetch = fetch,
  ) {}

  async scan(file: Parameters<MalwareScanner["scan"]>[0]) {
    if (!this.endpoint || !this.token)
      throw new IngestionError("MALWARE_SCANNER_UNAVAILABLE", true);
    const response = await this.request(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": file.mimeType,
        "x-content-sha256": file.sha256,
      },
      body: Buffer.from(file.bytes),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new IngestionError("MALWARE_SCANNER_ERROR", true);
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      (result.status !== "clean" && result.status !== "infected")
    ) {
      throw new IngestionError("MALWARE_SCANNER_INVALID_RESPONSE", true);
    }
    return result.status;
  }
}
