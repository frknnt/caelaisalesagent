import { inkOn, isMessage, type FrameMessage } from "./protocol";

// Runs inside the frame. The session token lives in this closure only: no
// cookie, no storage, nothing the customer's page can read.

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

let session = "";
let modal = false;
let expiry = 0;

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
}

function tell(message: FrameMessage) {
  window.parent.postMessage(message, embedder);
}

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

async function request(init: RequestInit) {
  return fetch("/api/widget/v1/session", {
    cache: "no-store",
    // Same connection as this document. The server reads no cookie here, and
    // browsers send none of the panel's into a frame on another site.
    credentials: "same-origin",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    ...init,
  });
}

async function open(token: string) {
  try {
    const response = await request({
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
    expireAfter(expiresIn);
    show("ready");
  } catch {
    show("failed");
  }
}

/** The panel was opened again: is the session still accepted? */
async function recheck() {
  if (!session) return;
  try {
    const response = await request({
      headers: { Authorization: `Bearer ${session}` },
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

function keepFocusInside(event: KeyboardEvent) {
  const stops = [
    ...document.querySelectorAll<HTMLElement>("a[href], button:not([hidden])"),
  ];
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

function start() {
  if (window.parent === window) {
    show("unavailable");
    return;
  }
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--on-accent", inkOn(accent));

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
  closeButton.addEventListener("click", () => tell({ cael: 1, type: "close" }));
  action.addEventListener("click", renew);
  tell({ cael: 1, type: "ready" });
}

start();
