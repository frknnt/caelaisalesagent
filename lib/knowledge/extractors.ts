import ExcelJS from "exceljs";
import mammoth from "mammoth";
import {
  getDocument,
  PasswordResponses,
} from "pdfjs-dist/legacy/build/pdf.mjs";

import { sha256 } from "./hash";
import {
  IngestionError,
  type ExtractedDocument,
  type ValidatedFile,
} from "./types";

const decode = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\0/g, "");

function asDocument(file: ValidatedFile, text: string): ExtractedDocument {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new IngestionError("EMPTY_EXTRACTED_TEXT", false);
  return {
    title: file.fileName,
    text: normalized,
    mimeType: file.mimeType,
    byteSize: file.bytes.byteLength,
    contentSha256: sha256(normalized),
  };
}

async function extractPdfPages(file: ValidatedFile) {
  try {
    const pdf = await getDocument({
      data: file.bytes.slice(),
      useSystemFonts: true,
    }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim(),
      );
    }
    return pages;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === PasswordResponses.NEED_PASSWORD ||
        error.code === PasswordResponses.INCORRECT_PASSWORD)
    ) {
      throw new IngestionError("ENCRYPTED_DOCUMENT", false);
    }
    throw new IngestionError("CORRUPT_DOCUMENT", false);
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) rows.push([...row, cell]);
  if (quoted) throw new IngestionError("CORRUPT_DOCUMENT", false);
  return rows.map((cells) => cells.join(" | ")).join("\n");
}

async function extractWorkbook(file: ValidatedFile) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(file.bytes).buffer);
    const output: string[] = [];
    workbook.eachSheet((sheet) => {
      output.push(`# ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        output.push(values.map(String).join(" | "));
      });
    });
    return output.join("\n");
  } catch {
    throw new IngestionError("CORRUPT_DOCUMENT", false);
  }
}

export async function extractFile(
  file: ValidatedFile,
): Promise<ExtractedDocument[]> {
  try {
    if (file.mimeType === "application/pdf") {
      const pages = await extractPdfPages(file);
      const documents = pages.flatMap((page, index) => {
        if (!page.trim()) return [];
        return [
          {
            ...asDocument(file, page),
            pageReference: `Page ${index + 1}`,
          },
        ];
      });
      if (!documents.length)
        throw new IngestionError("EMPTY_EXTRACTED_TEXT", false);
      return documents;
    }
    if (
      file.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(file.bytes),
      });
      return [asDocument(file, result.value)];
    }
    if (file.mimeType === "text/plain")
      return [asDocument(file, decode(file.bytes))];
    if (file.mimeType === "text/csv")
      return [asDocument(file, parseCsv(decode(file.bytes)))];
    return [asDocument(file, await extractWorkbook(file))];
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError("CORRUPT_DOCUMENT", false);
  }
}
