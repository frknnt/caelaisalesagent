import { widgetCopy } from "./copy";
import {
  frameScript,
  frameScriptHash,
  frameStyle,
  frameStyleHash,
} from "./generated/assets";
import type { WidgetSite } from "./store";

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => escapes[character] ?? "");
}

/** JSON for a data block: nothing in it can close the element or start markup. */
export function jsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Nothing but this document's own script, style and same-origin requests. */
export function frameCsp(embedOrigin: string) {
  return [
    "default-src 'none'",
    `script-src '${frameScriptHash}'`,
    `style-src '${frameStyleHash}'`,
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${embedOrigin}`,
  ].join("; ");
}

export const REFUSED_FRAME_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function renderFrameRefusal() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not available</title></head><body></body></html>';
}

interface FrameOptions {
  embedOrigin: string;
  site: Omit<WidgetSite, "siteKeyId">;
}

/**
 * Rendered on the server, so the AI disclosure and the way to a person are on
 * screen before any script runs, and stay there if none does.
 */
export function renderFrame({ embedOrigin, site }: FrameOptions) {
  const copy = widgetCopy(site.locale);
  const text = (value: string) => escapeHtml(value);
  const person = site.handoffUrl
    ? `<a class="person" id="person" href="${text(site.handoffUrl)}" target="_blank" rel="noopener noreferrer">${text(copy.person)}</a>`
    : `<p class="person-note">${text(copy.personFallback)}</p>`;
  return `<!doctype html>
<html lang="${text(copy.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${text(site.widgetTitle)}</title>
<style>${frameStyle}</style>
</head>
<body data-embedder="${text(embedOrigin)}" data-accent="${text(site.accentColor)}" data-loading="${text(copy.loading)}" data-ready="${text(copy.ready)}" data-failed="${text(copy.failed)}" data-retry="${text(copy.retry)}" data-expired="${text(copy.expired)}" data-restart="${text(copy.restart)}" data-unavailable="${text(copy.unavailable)}">
<div class="top">
<div class="identity">
<h1 id="title" tabindex="-1">${text(site.widgetTitle)}</h1>
<span class="tag">${text(copy.aiTag)}</span>
</div>
<button type="button" id="close" aria-label="${text(copy.close)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
</div>
<div class="content">
<p class="disclosure">${text(copy.disclosure)}</p>
<div id="state" data-state="loading">
<p id="status" role="status">${text(copy.loading)}</p>
<button type="button" id="action" hidden></button>
</div>
<ol id="log" aria-label="${text(copy.chat.messages)}"></ol>
<div id="prompts" hidden></div>
</div>
<form id="composer" hidden>
<textarea id="input" name="message" rows="1" maxlength="1000" aria-label="${text(copy.chat.inputLabel)}" placeholder="${text(copy.chat.placeholder)}" autocomplete="off"></textarea>
<button type="button" id="attach" aria-label="${text(copy.chat.attach)}" aria-describedby="attach-note"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
<button type="submit" id="send">${text(copy.chat.send)}</button>
</form>
<p id="attach-note" class="note" hidden>${text(copy.chat.attachSoon)}</p>
<p id="announce" class="visually-hidden" aria-live="polite"></p>
<div class="bottom">${person}
<div id="memory-row" class="memory" hidden><input type="checkbox" id="memory" aria-describedby="memory-hint"><label for="memory">${text(copy.chat.memory)}</label><p id="memory-hint">${text(copy.chat.memoryHint)}</p></div>
</div>
<script type="application/json" id="chat-copy">${jsonForHtml(copy.chat)}</script>
<script>${frameScript}</script>
</body>
</html>
`;
}
