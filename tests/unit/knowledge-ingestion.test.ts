import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { chunkDocument } from "@/lib/knowledge/chunking";
import { crawlSite } from "@/lib/knowledge/crawler";
import { extractFile } from "@/lib/knowledge/extractors";
import { DeterministicTestEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { validateFile } from "@/lib/knowledge/file-validation";
import { IngestionWorker } from "@/lib/knowledge/worker";
import {
  IngestionError,
  type ClaimedJob,
  type WorkerRepository,
} from "@/lib/knowledge/types";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("knowledge file ingestion", () => {
  it("validates and extracts TXT and CSV", async () => {
    const txt = await validateFile({
      bytes: bytes("Hello\nPrice: 1.250 TL"),
      fileName: "knowledge.txt",
      declaredMimeType: "text/plain",
    });
    await expect(extractFile(txt)).resolves.toMatchObject([
      { text: "Hello\nPrice: 1.250 TL" },
    ]);

    const csv = await validateFile({
      bytes: bytes('question,answer\n"Hello, world",Yes'),
      fileName: "faq.csv",
      declaredMimeType: "text/csv",
    });
    await expect(extractFile(csv)).resolves.toMatchObject([
      { text: "question | answer\nHello, world | Yes" },
    ]);
  });

  it("extracts XLSX and rejects corrupt or encrypted files", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Products").addRow(["Name", "Price"]);
    workbook.getWorksheet("Products")?.addRow(["Plan", "200 TL"]);
    const xlsxBytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const xlsx = await validateFile({
      bytes: xlsxBytes,
      fileName: "products.xlsx",
      declaredMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await expect(extractFile(xlsx)).resolves.toMatchObject([
      { text: expect.stringContaining("Plan | 200 TL") },
    ]);

    await expect(
      validateFile({
        bytes: bytes("%PDF-1.7\n1 0 obj << /Encrypt 2 0 R >>"),
        fileName: "secret.pdf",
        declaredMimeType: "application/pdf",
      }),
    ).rejects.toMatchObject({ code: "ENCRYPTED_DOCUMENT", retryable: false });

    await expect(
      validateFile({
        bytes: bytes("not a pdf"),
        fileName: "broken.pdf",
        declaredMimeType: "application/pdf",
      }),
    ).rejects.toMatchObject({ code: "FILE_SIGNATURE_MISMATCH" });
  });

  it("extracts supported PDF and DOCX files", async () => {
    const pdfBytes = new Uint8Array(
      await readFile(
        "docs/reference/CAEL_AI_SALES_AGENT_YOL_HARITASI_2026.pdf",
      ),
    );
    const pdf = await validateFile({
      bytes: pdfBytes,
      fileName: "roadmap.pdf",
      declaredMimeType: "application/pdf",
    });
    await expect(extractFile(pdf)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("CAEL AI SALES AGENT"),
          pageReference: expect.stringMatching(/^Page \d+$/),
        }),
      ]),
    );

    const docxBytes = new Uint8Array(
      await readFile(
        "node_modules/mammoth/test/test-data/single-paragraph.docx",
      ),
    );
    const docx = await validateFile({
      bytes: docxBytes,
      fileName: "source.docx",
      declaredMimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(extractFile(docx)).resolves.toMatchObject([
      { text: expect.stringMatching(/\S/) },
    ]);
  });

  it("marks extracted PII types and exact price lines", () => {
    const [chunk] = chunkDocument(
      "Contact sales@example.com\nIBAN TR12 1234 1234 1234 1234 1234 12\nPrice 1.250 TL",
    );
    expect(chunk).toMatchObject({
      piiTypes: ["email", "iban"],
      hasPrice: true,
      priceLineNumbers: [3],
    });
  });
});

describe("site crawler policy", () => {
  it("honors robots, allowlist, redirect and page limits", async () => {
    const pages = new Map([
      ["https://example.test/robots.txt", "User-agent: *\nDisallow: /private"],
      [
        "https://example.test/",
        '<html><head><title>Home</title></head><body>Hello<a href="/next">Next</a><a href="/private">Private</a><a href="https://evil.test/">Offsite</a></body></html>',
      ],
      ["https://example.test/next", "<html><body>Second</body></html>"],
    ]);
    const documents = await crawlSite(
      "https://example.test/",
      ["example.test"],
      {
        resolve: async () => ["203.0.113.10"],
        fetch: vi.fn(async (input) => {
          const value = pages.get(String(input));
          return value
            ? new Response(value, { headers: { "content-type": "text/html" } })
            : new Response("missing", { status: 404 });
        }),
      },
      { maxPages: 5, maxDepth: 2, maxBytesPerPage: 10_000 },
    );
    expect(documents.map((document) => document.canonicalUrl)).toEqual([
      "https://example.test/",
      "https://example.test/next",
    ]);
  });

  it("blocks private addresses and hosts outside the tenant allowlist", async () => {
    await expect(
      crawlSite("https://example.test/", ["example.test"], {
        resolve: async () => ["127.0.0.1"],
        fetch: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "CRAWL_PRIVATE_NETWORK_BLOCKED" });
  });
});

describe("worker retry and idempotent persistence boundary", () => {
  const job: ClaimedJob = {
    messageId: 1,
    jobId: "job",
    organizationId: "organization",
    siteId: "site",
    sourceId: "source",
    versionId: "version",
    sourceType: "manual",
    canonicalUrl: null,
    inputText: "Contact test@example.com\nPrice 100 TL",
    attemptCount: 1,
    maxAttempts: 3,
  };

  it("persists once, reports progress and completes", async () => {
    const repository: WorkerRepository = {
      claim: vi.fn(async () => job),
      loadFile: vi.fn(),
      allowedHosts: vi.fn(async () => []),
      setProgress: vi.fn(async () => undefined),
      replaceDocuments: vi.fn(async () => undefined),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const worker = new IngestionWorker(
      repository,
      { scan: vi.fn() },
      undefined,
      new DeterministicTestEmbeddingProvider(),
    );
    await expect(worker.processNext()).resolves.toBe(true);
    expect(repository.replaceDocuments).toHaveBeenCalledOnce();
    expect(repository.complete).toHaveBeenCalledWith(job);
    expect(repository.fail).not.toHaveBeenCalled();
    expect(repository.setProgress).toHaveBeenCalledWith("job", 95);
  });

  it("fails closed when the malware hook is unavailable", async () => {
    const fileJob = { ...job, sourceType: "file" as const, inputText: null };
    const repository: WorkerRepository = {
      claim: vi.fn(async () => fileJob),
      loadFile: vi.fn(async () => ({
        bytes: bytes("safe"),
        fileName: "safe.txt",
        declaredMimeType: "text/plain",
      })),
      allowedHosts: vi.fn(async () => []),
      setProgress: vi.fn(async () => undefined),
      replaceDocuments: vi.fn(async () => undefined),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const worker = new IngestionWorker(
      repository,
      {
        scan: vi.fn(async () => {
          throw new IngestionError("MALWARE_SCANNER_UNAVAILABLE", true);
        }),
      },
      undefined,
      new DeterministicTestEmbeddingProvider(),
    );
    await worker.processNext();
    expect(repository.fail).toHaveBeenCalledWith(
      fileJob,
      expect.objectContaining({
        code: "MALWARE_SCANNER_UNAVAILABLE",
        retryable: true,
      }),
    );
    expect(repository.replaceDocuments).not.toHaveBeenCalled();
  });
});
