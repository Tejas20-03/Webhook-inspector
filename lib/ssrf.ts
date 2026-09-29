import { promises as dns } from "node:dns";
import ipaddr from "ipaddr.js";

export class SsrfError extends Error {}

/**
 * Parses and validates a user-supplied replay target. Only plain http/https
 * URLs are allowed, and embedded credentials are rejected outright since
 * they have no legitimate use here and are a common SSRF/URL-confusion trick.
 */
export function validateTargetUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Only http:// and https:// URLs are allowed");
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with embedded credentials are not allowed");
  }

  return url;
}

/**
 * Resolves a hostname and rejects it if ANY resolved address falls outside
 * the public "unicast" range (private, loopback, link-local — including the
 * 169.254.169.254 cloud metadata address — CGNAT, multicast, reserved, etc).
 * Returns the first validated address so the caller can connect directly to
 * that IP instead of re-resolving the hostname, which is what defeats DNS
 * rebinding (an attacker's DNS flipping to a private IP between the check
 * and the actual connection).
 */
export async function resolveSafe(
  hostname: string
): Promise<{ ip: string; family: 4 | 6 }> {
  let results;
  try {
    results = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfError(`Could not resolve host: ${hostname}`);
  }

  if (results.length === 0) {
    throw new SsrfError(`Could not resolve host: ${hostname}`);
  }

  for (const { address } of results) {
    const range = ipaddr.process(address).range();
    if (range !== "unicast") {
      throw new SsrfError(
        `Resolved address ${address} is not a public address (${range})`
      );
    }
  }

  const [chosen] = results;
  return { ip: chosen.address, family: chosen.family as 4 | 6 };
}
