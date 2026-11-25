import type { SensitiveLine } from "./types";

const patterns = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  phone: /(?:\+?90\s*)?0?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/,
  identity: /\b[1-9]\d{10}\b/,
  iban: /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i,
  address:
    /\b(?:mah(?:allesi)?|cad(?:desi)?|sok(?:ak)?|bulvar(?:ı|i)?|apt\.?|no:)\b/i,
} as const;

const pricePattern = /(?:₺|\$|€)\s?\d|\b\d[\d.,]*\s?(?:TL|TRY|USD|EUR)\b/i;

export function inspectSensitiveLines(text: string): SensitiveLine[] {
  return text.split(/\r?\n/).map((line, index) => {
    const piiTypes = (
      Object.keys(patterns) as Array<keyof typeof patterns>
    ).filter((type) => patterns[type].test(line));
    return { line: index + 1, piiTypes, hasPrice: pricePattern.test(line) };
  });
}
