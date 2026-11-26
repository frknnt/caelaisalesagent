import { sha256 } from "./hash";
import { inspectSensitiveLines } from "./sensitive-content";
import type { PreparedChunk } from "./types";

export function chunkDocument(
  text: string,
  maxCharacters = 1800,
): PreparedChunk[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const chunks: Array<{ lines: string[]; start: number }> = [];
  let current: string[] = [];
  let start = 1;
  for (const [index, line] of lines.entries()) {
    const candidate = [...current, line].join("\n");
    if (candidate.length > maxCharacters && current.length > 0) {
      chunks.push({ lines: current, start });
      current = [line];
      start = index + 1;
    } else current.push(line);
  }
  if (current.join("").trim()) chunks.push({ lines: current, start });

  return chunks.map((chunk, ordinal) => {
    const content = chunk.lines.join("\n").trim();
    const sensitive = inspectSensitiveLines(content);
    const piiTypes = [
      ...new Set(sensitive.flatMap((line) => line.piiTypes)),
    ].sort();
    const priceLineNumbers = sensitive
      .filter((line) => line.hasPrice)
      .map((line) => chunk.start + line.line - 1);
    return {
      ordinal,
      content,
      contentSha256: sha256(content),
      piiTypes,
      hasPrice: priceLineNumbers.length > 0,
      priceLineNumbers,
      startLine: chunk.start,
      endLine: chunk.start + chunk.lines.length - 1,
    };
  });
}
