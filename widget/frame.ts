import { inkOn, isMessage, type FrameMessage } from "./protocol";

// Runs inside the frame. The session token lives in this closure only: no
// cookie, no storage, nothing the customer's page can read. The visitor key
// (not a token: it only finds this visitor's conversation again) is kept in
// this frame's own partitioned storage: the tab's sessionStorage, and
// localStorage only while the visitor has agreed to be remembered.

const { body } = document;
const embedder = body.dataset.embedder ?? "";
const accent = body.dataset.accent ?? "";
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const title = element("title");
const state = element("state");
const status = element("status");
const action = element<HTMLButtonElement>("action");
const closeButton = element<HTMLButtonElement>("close");
const log = element<HTMLOListElement>("log");
const prompts = element("prompts");
const composer = element<HTMLFormElement>("composer");
const input = element<HTMLTextAreaElement>("input");
const sendButton = element<HTMLButtonElement>("send");
const attach = element<HTMLButtonElement>("attach");
const attachNote = element("attach-note");
const announce = element("announce");
const memoryRow = element("memory-row");
const memory = element<HTMLInputElement>("memory");

interface ChatCopy {
  you: string;
  assistant: string;
  typing: string;
  sources: string;
  helpful: string;
  notHelpful: string;
  thanks: string;
  retrySend: string;
  handoff: string;
  memoryOn: string;
  memoryOff: string;
  prompts: string[];
  errors: Record<
    "rate" | "repeated" | "limit" | "invalid" | "failed" | "offline",
    string
  >;
}
const copy = JSON.parse(
  document.getElementById("chat-copy")?.textContent ?? "{}",
) as ChatCopy;

const KEY_NAME = "cael.visitor";
const MEMORY_VERSION = "memory-2026-11-26";

let session = "";
let modal = false;
let expiry = 0;
let busy = false;

type State = "loading" | "ready" | "failed" | "expired" | "unavailable";

function show(next: State) {
  state.dataset.state = next;
  status.textContent = body.dataset[next] ?? "";
  const label =
    next === "failed"
      ? body.dataset.retry
      : next === "expired"
        ? body.dataset.restart
        : undefined;
  // Focus must not disappear with the button that had it.
  if (!label && document.activeElement === action) title.focus();
  action.hidden = !label;
  action.textContent = label ?? "";
  const live = next === "ready";
  if (!live && composer.contains(document.activeElement)) title.focus();
  composer.hidden = !live;
  memoryRow.hidden = !live;
  prompts.hidden = !live || log.childElementCount > 0;
}

function tell(message: FrameMessage) {
  window.parent.postMessage(message, embedder);
}

function say(text: string) {
  // Re-set so the same words are announced again.
  announce.textContent = "";
  window.setTimeout(() => (announce.textContent = text), 50);
}

// Visitor key ---------------------------------------------------------------

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readKey(): string | null {
  return (
    storage("session")?.getItem(KEY_NAME) ??
    storage("local")?.getItem(KEY_NAME) ??
    null
  );
}

function keepKey(key: string, remember: boolean) {
  try {
    storage("session")?.setItem(KEY_NAME, key);
    if (remember) storage("local")?.setItem(KEY_NAME, key);
    else storage("local")?.removeItem(KEY_NAME);
  } catch {
    // Storage is full or blocked: the conversation still works, unremembered.
  }
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Requests --------------------------------------------------------------------

async function request(path: string, init: RequestInit = {}, timeoutMs = 8000) {
  return fetch(path, {
    cache: "no-store",
    // Same connection as this document. The server reads no cookie here, and
    // browsers send none of the panel's into a frame on another site.
    credentials: "same-origin",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    ...init,
  });
}

const authorized = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${session}`,
  ...extra,
});

const postJson = (path: string, value: unknown, timeoutMs?: number) =>
  request(
    path,
    {
      method: "POST",
      headers: authorized({ "Content-Type": "application/json" }),
      body: JSON.stringify(value),
    },
    timeoutMs,
  );

// Messages --------------------------------------------------------------------

interface Citation {
  sourceId: string;
  title: string;
  url: string | null;
}

interface ShownMessage {
  id: string;
  role: "visitor" | "assistant";
  clientMessageId: string | null;
  replyTo: string | null;
  status: "pending" | "completed" | "failed";
  text: string;
  citations: Citation[];
  handoff: boolean;
  feedback: -1 | 1 | null;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const created = document.createElement(tag);
  if (className) created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function scrollToEnd() {
  log.lastElementChild?.scrollIntoView({ block: "end" });
}

function visitorBubble(text: string, clientMessageId: string) {
  const item = node("li", "msg visitor");
  item.dataset.client = clientMessageId;
  item.append(node("span", "visually-hidden", `${copy.you}: `));
  item.append(node("p", "text", text));
  log.append(item);
  prompts.hidden = true;
  scrollToEnd();
  return item;
}

function assistantBubble() {
  const item = node("li", "msg assistant");
  item.setAttribute("aria-busy", "true");
  item.append(node("span", "visually-hidden", `${copy.assistant}: `));
  item.append(node("p", "text typing", copy.typing));
  log.append(item);
  scrollToEnd();
  return item;
}

async function sendFeedback(
  messageId: string,
  value: -1 | 1,
  buttons: HTMLButtonElement[],
) {
  const pressed = buttons.find(
    (button) => button.dataset.value === String(value),
  );
  const next = pressed?.getAttribute("aria-pressed") === "true" ? null : value;
  try {
    const response = await postJson("/api/widget/v1/feedback", {
      messageId,
      value: next,
    });
    if (!response.ok) return;
    for (const button of buttons)
      button.setAttribute(
        "aria-pressed",
        String(next !== null && button.dataset.value === String(next)),
      );
    if (next !== null) say(copy.thanks);
  } catch {
    // Feedback is optional; nothing to undo.
  }
}

function finishAssistant(item: HTMLElement, message: ShownMessage) {
  item.removeAttribute("aria-busy");
  item.dataset.id = message.id;
  item.textContent = "";
  item.append(node("span", "visually-hidden", `${copy.assistant}: `));
  item.append(node("p", "text", message.text));
  if (message.citations.length) {
    const sources = node("div", "sources");
    sources.append(node("p", "label", copy.sources));
    const list = node("ul");
    for (const citation of message.citations) {
      const entry = node("li");
      if (citation.url) {
        const link = node("a", undefined, citation.title);
        link.href = citation.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        entry.append(link);
      } else entry.textContent = citation.title;
      list.append(entry);
    }
    sources.append(list);
    item.append(sources);
  }
  if (message.handoff) item.append(node("p", "handoff", copy.handoff));
  const rate = node("div", "rate");
  const buttons = (
    [
      [
        1,
        copy.helpful,
        "M7 10v11M4 10h3l4-7a2 2 0 012 2v4h6a2 2 0 012 2l-2 7a2 2 0 01-2 2H7",
      ],
      [
        -1,
        copy.notHelpful,
        "M17 14V3M20 14h-3l-4 7a2 2 0 01-2-2v-4H5a2 2 0 01-2-2l2-7a2 2 0 012-2h10",
      ],
    ] as const
  ).map(([value, label, path]) => {
    const button = node("button", "icon");
    button.type = "button";
    button.dataset.value = String(value);
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(message.feedback === value));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", path);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linejoin", "round");
    svg.append(line);
    button.append(svg);
    return button;
  });
  for (const button of buttons) {
    button.addEventListener(
      "click",
      () =>
        void sendFeedback(
          message.id,
          Number(button.dataset.value) as -1 | 1,
          buttons,
        ),
    );
    rate.append(button);
  }
  item.append(rate);
  scrollToEnd();
}

/** A reply that could not be had: say so and offer to send the same message again. */
function failAssistant(
  item: HTMLElement,
  text: string,
  retry: (() => void) | null,
) {
  item.removeAttribute("aria-busy");
  item.classList.add("error");
  item.textContent = "";
  item.append(node("p", "text", text));
  if (retry) {
    const again = node("button", "retry", copy.retrySend);
    again.type = "button";
    again.addEventListener("click", () => {
      item.remove();
      retry();
    });
    item.append(again);
  }
  say(text);
}

function errorText(code: string | undefined, status: number) {
  switch (code) {
    case "WIDGET_RATE_LIMITED":
      return copy.errors.rate;
    case "WIDGET_MESSAGE_REPEATED":
      return copy.errors.repeated;
    case "WIDGET_LIMIT_REACHED":
      return copy.errors.limit;
    case "WIDGET_MESSAGE_INVALID":
      return copy.errors.invalid;
    default:
      return status === 0 ? copy.errors.offline : copy.errors.failed;
  }
}

/** Reads the event stream of one reply. */
async function readReply(response: Response, item: HTMLElement) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("no_stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf("\n\n");
      const event = /^event: (\w+)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data) as Record<string, unknown>;
      if (event === "delta" && typeof payload.text === "string") {
        streamed += payload.text;
        const text = item.querySelector(".text");
        if (text) {
          text.classList.remove("typing");
          text.textContent = streamed;
        }
      } else if (event === "reply") {
        return {
          id: String(payload.replyId),
          text: String(payload.text ?? ""),
          citations: (payload.citations as Citation[]) ?? [],
          handoff: payload.handoff === true,
        };
      } else if (event === "error") {
        return null;
      }
    }
  }
  throw new Error("stream_ended");
}

/** After a lost connection: the stored conversation decides. */
async function waitForReply(clientMessageId: string, item: HTMLElement) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    try {
      const response = await request("/api/widget/v1/conversation", {
        headers: authorized(),
      });
      if (!response.ok) break;
      const { messages } = (await response.json()) as {
        messages: ShownMessage[];
      };
      const question = messages.find(
        (m) => m.clientMessageId === clientMessageId,
      );
      const reply = question && messages.find((m) => m.replyTo === question.id);
      if (reply?.status === "completed") {
        finishAssistant(item, reply);
        say(`${copy.assistant}: ${reply.text}`);
        return true;
      }
      if (!reply || reply.status === "failed") break;
    } catch {
      // Still offline: try again.
    }
  }
  return false;
}

async function send(
  text: string,
  clientMessageId = crypto.randomUUID(),
  retry = false,
) {
  if (busy || !session) return;
  busy = true;
  sendButton.disabled = true;
  if (!retry || !log.querySelector(`[data-client="${clientMessageId}"]`))
    visitorBubble(text, clientMessageId);
  const item = assistantBubble();
  const again = () => void send(text, clientMessageId, true);
  try {
    const response = await postJson(
      "/api/widget/v1/messages",
      { clientMessageId, text },
      60_000,
    );
    if (response.status === 202) {
      if (!(await waitForReply(clientMessageId, item)))
        failAssistant(item, copy.errors.failed, again);
    } else if (!response.ok) {
      const code = (
        (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null
      )?.error?.code;
      if (response.status === 401 || code === "WIDGET_VISITOR_REQUIRED") {
        window.clearTimeout(expiry);
        session = "";
        item.remove();
        show("expired");
      } else {
        const repeatable =
          response.status >= 500 || code === "WIDGET_RATE_LIMITED";
        failAssistant(
          item,
          errorText(code, response.status),
          repeatable ? again : null,
        );
      }
    } else {
      const reply = await readReply(response, item);
      if (reply) {
        finishAssistant(item, {
          ...reply,
          role: "assistant",
          clientMessageId: null,
          replyTo: null,
          status: "completed",
          feedback: null,
        });
        say(`${copy.assistant}: ${reply.text}`);
      } else failAssistant(item, copy.errors.failed, again);
    }
  } catch {
    // The stream broke. The server keeps writing the reply; look it up.
    if (!(await waitForReply(clientMessageId, item)))
      failAssistant(item, copy.errors.offline, again);
  } finally {
    busy = false;
    sendButton.disabled = false;
  }
}

function render(messages: ShownMessage[]) {
  log.textContent = "";
  const byQuestion = new Map(
    messages.filter((m) => m.role === "assistant").map((m) => [m.replyTo, m]),
  );
  for (const message of messages) {
    if (message.role !== "visitor") continue;
    visitorBubble(message.text, message.clientMessageId ?? "");
    const reply = byQuestion.get(message.id);
    const item = assistantBubble();
    if (reply?.status === "completed") finishAssistant(item, reply);
    else if (reply?.status === "pending" && message.clientMessageId) {
      const clientId = message.clientMessageId;
      void waitForReply(clientId, item).then((found) => {
        if (!found)
          failAssistant(item, copy.errors.failed, () => {
            void send(message.text, clientId, true);
          });
      });
    } else
      failAssistant(item, copy.errors.failed, () => {
        void send(
          message.text,
          message.clientMessageId ?? crypto.randomUUID(),
          true,
        );
      });
  }
}

function renderPrompts() {
  prompts.textContent = "";
  for (const text of copy.prompts ?? []) {
    const button = node("button", "prompt", text);
    button.type = "button";
    button.addEventListener("click", () => {
      void send(text);
      input.focus();
    });
    prompts.append(button);
  }
}

// Session -------------------------------------------------------------------

function renew() {
  session = "";
  show("loading");
  tell({ cael: 1, type: "renew" });
}

function expireAfter(secondsLeft: number) {
  window.clearTimeout(expiry);
  expiry = window.setTimeout(
    () => {
      session = "";
      show("expired");
    },
    Math.max(0, secondsLeft) * 1000,
  );
}

/** Finds this visitor's conversation again, or starts an anonymous one. */
async function attachVisitor() {
  const response = await postJson("/api/widget/v1/visitor", {
    key: readKey(),
    fresh: randomKey(),
  });
  if (!response.ok) throw new Error("refused");
  const data = (await response.json()) as {
    key?: unknown;
    memoryConsent?: unknown;
    messages?: unknown;
  };
  if (typeof data.key !== "string" || !Array.isArray(data.messages))
    throw new Error("refused");
  memory.checked = data.memoryConsent === true;
  keepKey(data.key, memory.checked);
  render(data.messages as ShownMessage[]);
}

async function open(token: string) {
  try {
    const response = await request("/api/widget/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, embedder }),
    });
    const data: unknown = response.ok ? await response.json() : null;
    const { session: granted, expiresIn } = (data ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof granted !== "string" || typeof expiresIn !== "number") {
      throw new Error("refused");
    }
    session = granted;
    await attachVisitor();
    expireAfter(expiresIn);
    show("ready");
  } catch {
    session = "";
    show("failed");
  }
}

/** The panel was opened again: is the session still accepted? */
async function recheck() {
  if (!session) return;
  try {
    const response = await request("/api/widget/v1/session", {
      headers: authorized(),
    });
    if (response.status === 401) {
      window.clearTimeout(expiry);
      session = "";
      show("expired");
    }
  } catch {
    // Offline for a moment. The next request decides.
  }
}

async function setMemory(granted: boolean) {
  try {
    const response = await postJson("/api/widget/v1/visitor/consent", {
      granted,
      version: MEMORY_VERSION,
    });
    if (!response.ok) throw new Error("refused");
    const key = readKey();
    if (key) keepKey(key, granted);
    say(granted ? copy.memoryOn : copy.memoryOff);
  } catch {
    memory.checked = !granted;
    say(copy.errors.failed);
  }
}

function keepFocusInside(event: KeyboardEvent) {
  const stops = [
    ...document.querySelectorAll<HTMLElement>(
      "a[href], button:not([hidden]):not([disabled]), textarea, input",
    ),
  ].filter(
    (stop) => stop.offsetParent !== null || stop === document.activeElement,
  );
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last) return;
  const active = document.activeElement;
  const outside = !stops.includes(active as HTMLElement);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

function submit() {
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = "";
  void send(text);
}

function start() {
  if (window.parent === window) {
    show("unavailable");
    return;
  }
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--on-accent", inkOn(accent));
  renderPrompts();

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== embedder) return;
    const message: unknown = event.data;
    if (!isMessage(message)) return;
    if (message.type === "token" && typeof message.token === "string") {
      void open(message.token);
    } else if (message.type === "failed") {
      show("failed");
    } else if (message.type === "shown") {
      modal = message.modal === true;
      title.focus();
      void recheck();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      tell({ cael: 1, type: "close" });
    } else if (event.key === "Tab" && modal) {
      keepFocusInside(event);
    }
  });
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  attach.addEventListener("click", () => {
    attachNote.hidden = false;
    say(attachNote.textContent ?? "");
  });
  memory.addEventListener("change", () => void setMemory(memory.checked));
  closeButton.addEventListener("click", () => tell({ cael: 1, type: "close" }));
  action.addEventListener("click", renew);
  tell({ cael: 1, type: "ready" });
}

start();
