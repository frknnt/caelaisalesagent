// A customer website for the widget tests: a separate server on its own origin
// (`shop-a.localhost`, `evil.localhost`, ...). Chrome resolves every
// `*.localhost` name to this machine. Loopback only, test data only.
import { createServer } from "node:http";

import { hostPort, serverUrl } from "../../scripts/e2e-environment.mjs";

const defaultApp = serverUrl("standard");
const escape = (value) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.codePointAt(0)};`);

const policies = (app) => ({
  strict: `default-src 'none'; style-src 'self'; script-src 'self' ${app}; connect-src ${app}; frame-src ${app}; require-trusted-types-for 'script'`,
  "no-script": "default-src 'self'; style-src 'unsafe-inline'",
  "no-connect": `default-src 'self'; script-src 'self' ${app}; connect-src 'self'; frame-src ${app}`,
  "no-frame": `default-src 'self'; script-src 'self' ${app}; connect-src ${app}; frame-src 'self'`,
});

// Rules a careless or hostile theme could contain.
const hostileCss = `
* { color: rgb(255, 0, 0) !important; letter-spacing: 9px !important; opacity: 0.2;
    transform: rotate(3deg); font-size: 5px !important; }
div, button, iframe, svg, a, p { display: none !important; width: 1px !important; }
cael-widget { display: none !important; position: static !important; z-index: -1 !important; }
html, body { transform: none; opacity: 1; }`;

// Runs before the widget script: everything the page itself would notice.
const probe = `
window.hostErrors = [];
addEventListener("error", (event) => { if (event.message) hostErrors.push(String(event.message)); });
addEventListener("unhandledrejection", (event) => hostErrors.push("rejection: " + String(event.reason)));
window.hostGlobals = Object.getOwnPropertyNames(window);
`;

const sabotage = {
  fetch: "delete window.fetch; window.fetch = undefined;",
  shadow: "Element.prototype.attachShadow = undefined;",
  sheet: "window.CSSStyleSheet = undefined;",
  prototype:
    "Object.prototype.polluted = () => { throw new Error('polluted'); }; Array.prototype.extra = 1;",
  abort: "window.AbortController = undefined;",
  media: "window.matchMedia = undefined;",
};

// Only this machine: the performance test puts a proxy in between.
const appOf = (query) => {
  const app = query.get("app") ?? "";
  return /^http:\/\/127\.0\.0\.1:\d+$/.test(app) ? app : defaultApp;
};

function page(query) {
  const app = appOf(query);
  const key = query.get("key") ?? "";
  const copies = Number(query.get("copies") ?? "1");
  const breakage = sabotage[query.get("break") ?? ""] ?? "";
  const attribute =
    query.get("in") === "url" ? "" : ` data-site-key="${escape(key)}"`;
  const source =
    query.get("in") === "url"
      ? `${app}/widget/v1/loader.js?key=${escape(key)}`
      : `${app}/widget/v1/loader.js`;
  const script = `<script async crossorigin="anonymous" src="${source}"${attribute}></script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Customer website</title>
<link rel="stylesheet" href="/page.css">
${query.get("css") === "hostile" ? "<style>" + hostileCss + "</style>" : ""}
<script src="/probe.js"></script>
${breakage ? "<script>" + breakage + "</script>" : ""}
${query.get("at") === "end" ? "" : script.repeat(copies)}
</head>
<body>
<main>
<h1>Customer website</h1>
<p id="content">The page content does not depend on the widget.</p>
<button type="button" id="buy" onclick="this.textContent = 'Added'">Add to cart</button>
${query.get("frame") ? `<iframe id="target" title="target" src="${escape(query.get("frame"))}"></iframe>` : ""}
</main>
${query.get("at") === "end" ? script.repeat(copies) : ""}
</body>
</html>`;
}

const handler = (request, response) => {
  const url = new URL(request.url ?? "/", "http://host.localhost");
  const send = (type, body, headers = {}) => {
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      ...headers,
    });
    response.end(body);
  };
  if (url.pathname === "/health") send("text/plain", "ok");
  else if (url.pathname === "/probe.js") send("text/javascript", probe);
  else if (url.pathname === "/page.css") {
    send(
      "text/css",
      "body { margin: 0; font: 16px/1.5 system-ui; background: #fff; color: #111; } main { max-width: 40rem; padding: 16px; } button { min-height: 44px; font-size: 16px; }",
    );
  } else if (url.pathname === "/") {
    const policy = policies(appOf(url.searchParams))[
      url.searchParams.get("csp") ?? ""
    ];
    send(
      "text/html; charset=utf-8",
      page(url.searchParams),
      policy ? { "Content-Security-Policy": policy } : {},
    );
  } else {
    response.writeHead(404);
    response.end();
  }
};

// Both loopback addresses: a refused ::1 would slow every page down on Windows.
for (const address of ["127.0.0.1", "::1"]) {
  createServer(handler).listen(hostPort, address);
}
