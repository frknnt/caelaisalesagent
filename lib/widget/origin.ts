import { parse } from "tldts";

export interface EmbedOrigin {
  origin: string;
  hostname: string;
}

/** Same shape as the `domains.hostname` check in the database. */
const hostnamePattern =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const isLocalhostName = (hostname: string) => hostname.endsWith(".localhost");

/**
 * The page a browser says it is on, or null. Strict: the header must be exactly
 * what a browser serializes, over HTTPS on the default port. Only a server that
 * runs on loopback itself accepts `*.localhost`, with any port.
 */
export function parseEmbedOrigin(
  header: string | null,
  { allowLoopback }: { allowLoopback: boolean },
): EmbedOrigin | null {
  if (!header || header.length > 300) return null;
  let url: URL;
  try {
    url = new URL(header);
  } catch {
    return null;
  }
  // Rejects `null`, paths, credentials, upper case and default ports.
  if (url.origin !== header) return null;

  const { hostname } = url;
  if (hostname.length > 253 || !hostnamePattern.test(hostname)) return null;
  // All-numeric last label: an IPv4 address, which can never be a domain row.
  if (/\.\d+$/.test(hostname)) return null;

  if (isLocalhostName(hostname)) {
    const web = url.protocol === "http:" || url.protocol === "https:";
    return allowLoopback && web ? { origin: header, hostname } : null;
  }
  return url.protocol === "https:" && url.port === ""
    ? { origin: header, hostname }
    : null;
}

/**
 * Wildcards are limited to names a single owner controls. A public suffix, ICANN
 * or private (`com`, `co.uk`, `vercel.app`, `github.io`), is never one.
 */
export function canAllowSubdomains(hostname: string): boolean {
  if (!hostnamePattern.test(hostname)) return false;
  const result = parse(hostname, { allowPrivateDomains: true });
  return (
    !result.isIp &&
    (result.isIcann === true || result.isPrivate === true) &&
    result.domain !== null
  );
}
