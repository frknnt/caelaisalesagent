import type { ConversationTurn } from "./prompt";

export const SUMMARY_MAX_CHARS = 1500;

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/**
 * Folds the turns that left the model window into the running summary. It is
 * deterministic (no model call, no cost) and keeps the newest lines when it
 * grows past the limit. The result is visitor-derived: the prompt always wraps
 * it as untrusted data.
 */
export function foldIntoSummary(
  previous: string | null,
  dropped: readonly ConversationTurn[],
  maxChars = SUMMARY_MAX_CHARS,
): string | null {
  if (!dropped.length) return previous;
  const lines = (previous ? previous.split("\n") : []).filter(Boolean);
  for (const turn of dropped) {
    lines.push(
      turn.role === "user"
        ? `Ziyaretci: ${clip(turn.content, 200)}`
        : `Asistan: ${clip(turn.content, 160)}`,
    );
  }
  while (lines.length > 1 && lines.join("\n").length > maxChars) lines.shift();
  const text = lines.join("\n");
  return text.length > maxChars ? text.slice(text.length - maxChars) : text;
}
