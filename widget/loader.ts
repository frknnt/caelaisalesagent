import { inkOn, isMessage, type HostMessage } from "./protocol";

// Runs on a page that is not ours. Rules: no global, no exception, no change to
// the page outside one element of our own, and nothing at all on screen unless
// the server allowed this key on this origin.

interface Bootstrap {
  frame: string;
  token: string;
  staleAt: number;
  title: string;
  accent: string;
  position: "bottom-right" | "bottom-left";
  handoffUrl: string | null;
  copy: Record<(typeof copyKeys)[number], string>;
}

const copyKeys = [
  "lang",
  "open",
  "close",
  "loading",
  "failed",
  "retry",
  "person",
  "personFallback",
] as const;

const TAG = "cael-widget";
const BOOTSTRAP_TIMEOUT_MS = 6000;
const FRAME_TIMEOUT_MS = 8000;
const FULL_SCREEN_QUERY = "(max-width: 479px), (max-height: 479px)";

/** The server's answer, or null when any part is not what it must be. */
function parseBootstrap(value: unknown, appOrigin: string): Bootstrap | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  const theme = (data.theme ?? {}) as Record<string, unknown>;
  const copy = (data.copy ?? {}) as Record<string, unknown>;
  const { frame, token, expiresIn, title, handoffUrl } = data;
  if (
    typeof frame !== "string" ||
    !frame.startsWith(`${appOrigin}/widget/v1/frame?`) ||
    typeof token !== "string" ||
    typeof expiresIn !== "number" ||
    typeof title !== "string" ||
    typeof theme.accent !== "string" ||
    !/^#[0-9a-f]{6}$/.test(theme.accent) ||
    copyKeys.some((key) => typeof copy[key] !== "string")
  ) {
    return null;
  }
  return {
    frame,
    token,
    // Refreshed well before the server would refuse it.
    staleAt: performance.now() + expiresIn * 1000 * 0.75,
    title,
    accent: theme.accent,
    position: theme.position === "bottom-left" ? "bottom-left" : "bottom-right",
    handoffUrl:
      typeof handoffUrl === "string" && handoffUrl.startsWith("https://")
        ? handoffUrl
        : null,
    copy: copy as Bootstrap["copy"],
  };
}

async function fetchBootstrap(
  appOrigin: string,
  key: string,
): Promise<Bootstrap | null> {
  let timer = 0;
  try {
    const timeout = new AbortController();
    timer = window.setTimeout(() => timeout.abort(), BOOTSTRAP_TIMEOUT_MS);
    const response = await fetch(`${appOrigin}/api/widget/v1/bootstrap`, {
      method: "POST",
      // A string body is a simple request: no preflight round trip.
      body: JSON.stringify({ key }),
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: timeout.signal,
    });
    if (!response.ok) return null;
    return parseBootstrap(await response.json(), appOrigin);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const hostStyles = [
  ["all", "initial"],
  ["position", "fixed"],
  ["top", "0"],
  ["left", "0"],
  ["width", "0"],
  ["height", "0"],
  ["z-index", "2147483000"],
] as const;

const styles = `
.root { all: initial; display: block; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button, a {
  font: 600 16px/1.4 ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
  touch-action: manipulation;
  cursor: pointer;
}
.launcher, .panel { position: fixed; }
.launcher {
  bottom: max(16px, env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 6px 18px rgb(0 0 0 / 0.22);
}
.launcher svg { display: block; margin: auto; }
.right { right: max(16px, env(safe-area-inset-right)); }
.left { left: max(16px, env(safe-area-inset-left)); }
.panel {
  bottom: calc(max(16px, env(safe-area-inset-bottom)) + 68px);
  width: 376px;
  height: min(600px, calc(100vh - 100px));
  max-width: calc(100vw - 32px);
  overflow: hidden;
  border: 1px solid #868d99;
  border-radius: 20px;
  background: #ffffff;
  color: #0b0c0f;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.24);
}
iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
.notice {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 24px;
  background: #ffffff;
  color: #0b0c0f;
  font: 400 16px/1.5 ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
}
.notice p { margin: 0 0 16px; }
.notice button, .notice a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin: 0 8px 12px 0;
  padding: 8px 18px;
  border: 1px solid #0b0c0f;
  border-radius: 12px;
  background: #ffffff;
  color: #0b0c0f;
  text-decoration: none;
}
:focus-visible { outline: 3px solid #4f41c4; outline-offset: 3px; }
.panel:focus-visible { outline-offset: -3px; }
@media ${FULL_SCREEN_QUERY} {
  .panel {
    inset: 0;
    width: 100%;
    height: 100%;
    height: 100dvh;
    max-width: none;
    border: 0;
    border-radius: 0;
  }
  .panel:not([hidden]) ~ .launcher { display: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .panel { transition: opacity 140ms ease-out, translate 140ms ease-out; }
  @starting-style {
    .panel { opacity: 0; translate: 0 8px; }
  }
}
@media (forced-colors: active) {
  .launcher { border-color: ButtonText; }
}
`;

/** Constructed sheets are not inline styles, so a strict page CSP allows them. */
function applyStyles(root: ShadowRoot) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = styles;
    root.append(style);
  }
}

function icon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  for (const [name, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: "26",
    height: "26",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  })) {
    svg.setAttribute(name, value);
  }
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M4 5h16v11H10l-4.5 4v-4H4z");
  svg.append(path);
  return svg;
}

function button(label: string, onClick: () => void) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function mount(
  root: ShadowRoot,
  first: Bootstrap,
  key: string,
  appOrigin: string,
) {
  let current = first;
  let frame: HTMLIFrameElement | null = null;
  let frameReady = false;
  let watchdog = 0;
  let tokenGiven = false;
  let loading = false;

  applyStyles(root);
  const side = current.position === "bottom-left" ? "left" : "right";

  const panel = document.createElement("div");
  panel.className = `panel ${side}`;
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", current.title);

  const notice = document.createElement("div");
  notice.className = "notice";
  panel.append(notice);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = `launcher ${side}`;
  launcher.setAttribute("aria-label", `${current.copy.open}: ${current.title}`);
  launcher.setAttribute("aria-expanded", "false");
  launcher.style.setProperty("--accent", current.accent);
  launcher.style.setProperty("--on-accent", inkOn(current.accent));
  launcher.append(icon());

  const isFullScreen = () =>
    typeof matchMedia === "function" && matchMedia(FULL_SCREEN_QUERY).matches;

  const send = (message: HostMessage) =>
    frame?.contentWindow?.postMessage(message, appOrigin);

  const showLoading = () => {
    const text = document.createElement("p");
    text.setAttribute("role", "status");
    text.textContent = current.copy.loading;
    notice.replaceChildren(text);
    notice.hidden = false;
  };

  const showFailure = () => {
    clearTimeout(watchdog);
    frame?.remove();
    frame = null;
    frameReady = false;
    const text = document.createElement("p");
    text.setAttribute("role", "alert");
    text.textContent = current.copy.failed;
    notice.replaceChildren(
      text,
      button(current.copy.retry, () => {
        panel.focus();
        void loadFrame();
      }),
    );
    // The way to a person must not depend on the part that failed.
    if (current.handoffUrl) {
      const person = document.createElement("a");
      person.href = current.handoffUrl;
      person.target = "_blank";
      person.rel = "noopener noreferrer";
      person.textContent = current.copy.person;
      notice.append(person);
    } else {
      const person = document.createElement("p");
      person.textContent = current.copy.personFallback;
      notice.append(person);
    }
    notice.append(button(current.copy.close, close));
    notice.hidden = false;
  };

  /** A bootstrap that the server will still accept, or null. */
  const freshBootstrap = async () => {
    if (performance.now() < current.staleAt) return current;
    const next = await fetchBootstrap(appOrigin, key);
    if (next) current = next;
    return next;
  };

  const loadFrame = async () => {
    if (loading || frame) return;
    loading = true;
    showLoading();
    const bootstrap = await freshBootstrap();
    loading = false;
    if (!bootstrap) {
      showFailure();
      return;
    }
    const next = document.createElement("iframe");
    next.title = bootstrap.title;
    next.referrerPolicy = "no-referrer";
    next.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    next.src = bootstrap.frame;
    frame = next;
    frameReady = false;
    tokenGiven = false;
    clearTimeout(watchdog);
    watchdog = setTimeout(showFailure, FRAME_TIMEOUT_MS) as unknown as number;
    panel.prepend(next);
  };

  const handOverToken = async (renewing: boolean) => {
    // One token buys one session, so a renewal always needs a new one.
    if (renewing) current = { ...current, staleAt: 0 };
    const bootstrap = await freshBootstrap();
    if (!bootstrap) {
      send({ cael: 1, type: "failed" });
      return;
    }
    send({ cael: 1, type: "token", token: bootstrap.token });
    current = { ...bootstrap, staleAt: 0 };
  };

  /** Panel open and frame ready. The first time, this starts the session. */
  const activate = () => {
    frame?.focus();
    send({ cael: 1, type: "shown", modal: isFullScreen() });
    if (tokenGiven) return;
    tokenGiven = true;
    void handOverToken(false);
  };

  const open = () => {
    if (!panel.hidden) return;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-modal", String(isFullScreen()));
    if (frameReady) {
      activate();
    } else {
      panel.focus();
      void loadFrame();
    }
  };

  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  };

  addEventListener("message", (event) => {
    if (
      !frame ||
      event.source !== frame.contentWindow ||
      event.origin !== appOrigin ||
      !isMessage(event.data)
    ) {
      return;
    }
    const { type } = event.data;
    if (type === "ready" && !frameReady) {
      clearTimeout(watchdog);
      frameReady = true;
      notice.hidden = true;
      notice.replaceChildren();
      if (!panel.hidden) activate();
    } else if (type === "renew") {
      void handOverToken(true);
    } else if (type === "close") {
      close();
    }
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  // About to be opened: load the document now. No session before it is open.
  for (const intent of ["pointerenter", "touchstart", "focus"]) {
    launcher.addEventListener(intent, () => void loadFrame(), {
      once: true,
      passive: true,
    });
  }

  const container = document.createElement("div");
  container.className = "root";
  container.lang = current.copy.lang;
  container.append(panel, launcher);
  root.append(container);
}

function whenBodyExists(run: () => void) {
  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}

async function start(script: HTMLScriptElement) {
  const source = new URL(script.src);
  const key = script.dataset.siteKey ?? source.searchParams.get("key") ?? "";
  if (!/^cael_pk_[0-9a-f]{32}$/.test(key)) return;
  // The element is also the lock against a second copy of this script.
  if (document.querySelector(TAG)) return;
  const host = document.createElement(TAG);
  // Inline and important, so no rule of the page can move or restyle it.
  for (const [name, value] of hostStyles) {
    host.style.setProperty(name, value, "important");
  }
  host.style.setProperty("display", "none", "important");
  document.documentElement.append(host);

  const bootstrap = await fetchBootstrap(source.origin, key);
  if (!bootstrap) {
    host.remove();
    return;
  }
  whenBodyExists(() => {
    try {
      document.body.append(host);
      mount(host.attachShadow({ mode: "open" }), bootstrap, key, source.origin);
      host.style.setProperty("display", "block", "important");
    } catch {
      host.remove();
    }
  });
}

try {
  const script = document.currentScript;
  if (script instanceof HTMLScriptElement) start(script).catch(() => {});
} catch {
  // Never the customer's problem.
}
