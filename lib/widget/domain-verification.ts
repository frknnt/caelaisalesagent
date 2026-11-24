import { resolve as resolveDns } from "node:dns/promises";

export interface DnsPort {
  /** TXT records of a name, already joined. Throws when there is no answer. */
  txt(name: string): Promise<string[]>;
}

const DNS_TIMEOUT_MS = 5000;
const CHALLENGE_LABEL = "_cael-challenge";
const CHALLENGE_PREFIX = "cael-site-verification=";

export function domainChallenge(hostname: string, token: string) {
  return {
    name: `${CHALLENGE_LABEL}.${hostname}`,
    value: `${CHALLENGE_PREFIX}${token}`,
  };
}

/**
 * Proof that the tenant controls the DNS of the name. The token belongs to one
 * row of one tenant, so another tenant's record proves nothing.
 */
export async function isDomainProven(
  dns: DnsPort,
  hostname: string,
  token: string,
  timeoutMs = DNS_TIMEOUT_MS,
): Promise<boolean> {
  const { name, value } = domainChallenge(hostname, token);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      dns.txt(name),
      new Promise<string[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS_TIMEOUT")), timeoutMs);
      }),
    ]);
    return records.includes(value);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const systemDns: DnsPort = {
  async txt(name) {
    const records = await resolveDns(name, "TXT");
    return records.map((chunks) => chunks.join(""));
  },
};
