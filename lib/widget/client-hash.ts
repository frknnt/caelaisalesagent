import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { WidgetConfig } from "./config";
import { derivePurposeKey } from "./tokens";

type HeaderReader = Pick<Headers, "get">;

/** IPv4 address, or the /64 network of an IPv6 address. */
export function clientNetwork(address: string): string | null {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const value = mapped ?? address;
  if (isIP(value) === 4) return value;
  if (isIP(value) !== 6) return null;
  const [head = "", tail = ""] = (value.split("%")[0] ?? "").split("::");
  const left = head ? head.split(":") : [];
  const right = value.includes("::") && tail ? tail.split(":") : [];
  const groups = value.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  return groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(":");
}

/**
 * Stable for one client for one UTC day, useless afterwards. The address itself
 * is never stored or logged. Null where the platform gives no address.
 */
export function clientHash(
  headers: HeaderReader,
  config: Pick<WidgetConfig, "keys" | "clientIpHeader">,
  now: Date,
): string | null {
  if (!config.clientIpHeader) return null;
  // The last entry is the one the nearest proxy added. Earlier ones are claims.
  const address = headers.get(config.clientIpHeader)?.split(",").at(-1)?.trim();
  // A missing or unreadable address shares one bucket instead of having none.
  const network = (address && clientNetwork(address)) || "unknown";
  return createHmac("sha256", derivePurposeKey(config.keys[0], "client-hash"))
    .update(`${now.toISOString().slice(0, 10)}|${network}`)
    .digest("hex");
}
