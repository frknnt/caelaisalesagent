import { extname } from "node:path";

import { fileTypeFromBuffer } from "file-type";

import { sha256 } from "./hash";
import {
  IngestionError,
  supportedMimeTypes,
  type BinarySource,
  type SupportedMimeType,
  type ValidatedFile,
} from "./types";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const mimeByExtension: Record<string, SupportedMimeType> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const normalizeMime = (value: string) => value.split(";", 1)[0]?.trim() ?? "";

export async function validateFile(file: BinarySource): Promise<ValidatedFile> {
  if (file.bytes.byteLength === 0)
    throw new IngestionError("EMPTY_FILE", false);
  if (file.bytes.byteLength > MAX_FILE_BYTES)
    throw new IngestionError("FILE_TOO_LARGE", false);

  const extension = extname(file.fileName).toLowerCase();
  const expected = mimeByExtension[extension];
  if (!expected) throw new IngestionError("UNSUPPORTED_FILE_TYPE", false);

  const declared = normalizeMime(file.declaredMimeType);
  if (!supportedMimeTypes.includes(declared as SupportedMimeType))
    throw new IngestionError("UNSUPPORTED_MIME_TYPE", false);
  if (declared !== expected)
    throw new IngestionError("MIME_EXTENSION_MISMATCH", false);

  const detected = await fileTypeFromBuffer(file.bytes);
  const isText = expected === "text/plain" || expected === "text/csv";
  const isOoxml = expected.includes("openxmlformats");
  const signatureMatches = isText
    ? !detected
    : isOoxml
      ? detected?.mime === expected || detected?.mime === "application/zip"
      : detected?.mime === expected;
  if (!signatureMatches)
    throw new IngestionError("FILE_SIGNATURE_MISMATCH", false);

  if (
    expected === "application/pdf" &&
    new TextDecoder("latin1")
      .decode(file.bytes.slice(0, 64 * 1024))
      .includes("/Encrypt")
  ) {
    throw new IngestionError("ENCRYPTED_DOCUMENT", false);
  }

  return { ...file, mimeType: expected, sha256: sha256(file.bytes) };
}
