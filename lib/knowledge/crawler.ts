import { isIP } from "node:net";

import { parse } from "node-html-parser";

import { sha256 } from "./hash";
import { IngestionError, type ExtractedDocument } from "./types";

export type CrawlLimits = {
  maxPages: number;
  maxDepth: number;
  maxBytesPerPage: number;
};

export type CrawlDependencies = {
  fetch: typeof fetch;
  resolve: (hostname: string) => Promise<string[]>;
};

const privateIpv4 = (ip: string) => {
  const parts = ip.split(".").map(Number);
  const [a = -1, b = -1] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
};

const privateIpv6 = (ip: string) =>
  ip === "::1" ||
  ip === "::" ||
  ip.toLowerCase().startsWith("fc") ||
  ip.toLowerCase().startsWith("fd") ||
  ip.toLowerCase().startsWith("fe8") ||
  ip.toLowerCase().startsWith("fe9") ||
  ip.toLowerCase().startsWith("fea") ||
  ip.toLowerCase().startsWith("feb");

async function assertPublicHost(
  url: URL,
  allowedHosts: Set<string>,
  resolve: CrawlDependencies["resolve"],
) {
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname.toLowerCase())
  )
    throw new IngestionError("CRAWL_URL_NOT_ALLOWED", false);
  const addresses = isIP(url.hostname)
    ? [url.hostname]
    : await resolve(url.hostname);
  if (
    addresses.length === 0 ||
    addresses.some((ip) => (isIP(ip) === 4 ? privateIpv4(ip) : privateIpv6(ip)))
  ) {
    throw new IngestionError("CRAWL_PRIVATE_NETWORK_BLOCKED", false);
  }
}

function allowedByRobots(robots: string, path: string) {
  let applies = false;
  const disallows: string[] = [];
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") applies = value === "*";
    if (field === "disallow" && applies && value) disallows.push(value);
  }
  return !disallows.some((prefix) => path.startsWith(prefix));
}

async function fetchBounded(
  url: URL,
  deps: CrawlDependencies,
  allowedHosts: Set<string>,
  maxBytes: number,
) {
  await assertPublicHost(url, allowedHosts, deps.resolve);
  const response = await deps.fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "CaelKnowledgeBot/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new IngestionError("CRAWL_REDIRECT_INVALID", false);
    const redirected = new URL(location, url);
    await assertPublicHost(redirected, allowedHosts, deps.resolve);
    return fetchBounded(redirected, deps, allowedHosts, maxBytes);
  }
  if (!response.ok)
    throw new IngestionError(
      response.status >= 500 ? "CRAWL_UPSTREAM_ERROR" : "CRAWL_HTTP_ERROR",
      response.status >= 500,
    );
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes)
    throw new IngestionError("CRAWL_PAGE_TOO_LARGE", false);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes)
    throw new IngestionError("CRAWL_PAGE_TOO_LARGE", false);
  return { response, bytes, url };
}

export async function crawlSite(
  startUrl: string,
  allowedHostnames: string[],
  deps: CrawlDependencies,
  limits: CrawlLimits = {
    maxPages: 25,
    maxDepth: 2,
    maxBytesPerPage: 2_000_000,
  },
): Promise<ExtractedDocument[]> {
  const start = new URL(startUrl);
  const allowedHosts = new Set(
    allowedHostnames.map((host) => host.toLowerCase()),
  );
  await assertPublicHost(start, allowedHosts, deps.resolve);

  let robots = "";
  try {
    const result = await fetchBounded(
      new URL("/robots.txt", start.origin),
      deps,
      allowedHosts,
      256_000,
    );
    robots = new TextDecoder().decode(result.bytes);
  } catch (error) {
    if (!(error instanceof IngestionError) || error.retryable) throw error;
  }

  const queued: Array<{ url: URL; depth: number }> = [{ url: start, depth: 0 }];
  const visited = new Set<string>();
  const documents: ExtractedDocument[] = [];
  while (queued.length && documents.length < limits.maxPages) {
    const current = queued.shift();
    if (!current) break;
    current.url.hash = "";
    const canonical = current.url.toString();
    if (visited.has(canonical)) continue;
    visited.add(canonical);
    if (!allowedByRobots(robots, current.url.pathname)) continue;

    const { response, bytes } = await fetchBounded(
      current.url,
      deps,
      allowedHosts,
      limits.maxBytesPerPage,
    );
    if (
      !(response.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("text/html")
    )
      continue;
    const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const root = parse(html);
    root
      .querySelectorAll("script,style,noscript,svg")
      .forEach((node) => node.remove());
    const text = root.textContent
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim();
    if (text) {
      documents.push({
        title: root.querySelector("title")?.text.trim() || current.url.pathname,
        text,
        mimeType: "text/html",
        byteSize: bytes.byteLength,
        contentSha256: sha256(text),
        canonicalUrl: canonical,
      });
    }
    if (current.depth >= limits.maxDepth) continue;
    for (const anchor of root.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (!href) continue;
      try {
        const next = new URL(href, current.url);
        if (
          next.protocol === "https:" &&
          allowedHosts.has(next.hostname.toLowerCase())
        )
          queued.push({ url: next, depth: current.depth + 1 });
      } catch {
        // Invalid links are untrusted page data and are ignored.
      }
    }
  }
  if (!documents.length) throw new IngestionError("CRAWL_NO_CONTENT", false);
  return documents;
}
