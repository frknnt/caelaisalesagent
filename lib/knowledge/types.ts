export const supportedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type SupportedMimeType = (typeof supportedMimeTypes)[number];
export type SourceType = "site" | "url" | "manual" | "faq" | "file";

export class IngestionError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "IngestionError";
  }
}

export type BinarySource = {
  bytes: Uint8Array;
  fileName: string;
  declaredMimeType: string;
};

export type ValidatedFile = BinarySource & {
  mimeType: SupportedMimeType;
  sha256: string;
};

export type ExtractedDocument = {
  title: string;
  text: string;
  mimeType: string;
  byteSize: number;
  contentSha256: string;
  canonicalUrl?: string;
};

export type SensitiveLine = {
  line: number;
  piiTypes: Array<"email" | "phone" | "identity" | "address" | "iban">;
  hasPrice: boolean;
};

export type PreparedChunk = {
  ordinal: number;
  content: string;
  contentSha256: string;
  piiTypes: SensitiveLine["piiTypes"];
  hasPrice: boolean;
  priceLineNumbers: number[];
};

export type ClaimedJob = {
  messageId: number;
  jobId: string;
  organizationId: string;
  siteId: string;
  sourceId: string;
  versionId: string;
  sourceType: SourceType;
  canonicalUrl: string | null;
  inputText: string | null;
  attemptCount: number;
  maxAttempts: number;
};

export interface MalwareScanner {
  scan(file: ValidatedFile): Promise<"clean" | "infected">;
}

export interface WorkerRepository {
  claim(): Promise<ClaimedJob | null>;
  loadFile(job: ClaimedJob): Promise<BinarySource>;
  allowedHosts(job: ClaimedJob): Promise<string[]>;
  setProgress(jobId: string, progress: number): Promise<void>;
  replaceDocuments(
    job: ClaimedJob,
    documents: ExtractedDocument[],
    chunks: PreparedChunk[][],
    malwareStatus: "not_required" | "clean",
  ): Promise<void>;
  complete(job: ClaimedJob): Promise<void>;
  fail(job: ClaimedJob, error: IngestionError): Promise<void>;
}
