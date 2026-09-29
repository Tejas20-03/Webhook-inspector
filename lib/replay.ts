import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import { resolveSafe, validateTargetUrl, SsrfError } from "@/lib/ssrf";

const REPLAY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SNIPPET_BYTES = 2000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // hard cap so a huge/malicious response can't exhaust memory
const STRIPPED_HEADERS = new Set(["host", "content-length", "connection"]);

export type ReplayResult = {
  statusCode: number | null;
  durationMs: number;
  responseSnippet: string | null;
  error: string | null;
};

export async function replayRequest(params: {
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: "utf8" | "base64";
}): Promise<ReplayResult> {
  const start = performance.now();

  try {
    const url = validateTargetUrl(params.targetUrl);
    const { ip, family } = await resolveSafe(url.hostname);

    const bodyBuffer = params.body
      ? Buffer.from(params.body, params.bodyEncoding === "base64" ? "base64" : "utf8")
      : Buffer.alloc(0);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.headers)) {
      if (!STRIPPED_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    headers["content-length"] = String(bodyBuffer.length);

    const transport = url.protocol === "https:" ? https : http;

    // `autoSelectFamily` (Happy Eyeballs) isn't in @types/node's RequestOptions
    // even though Node's http/https accept and forward it to net.connect, so
    // it's typed via this intersection rather than widening RequestOptions itself.
    const requestOptions: (http.RequestOptions | https.RequestOptions) & {
      autoSelectFamily?: boolean;
    } = {
      hostname: url.hostname, // kept for Host header / TLS SNI + cert validation
      // pin the connection to the address we already vetted, instead of
      // letting Node re-resolve the hostname (which is what a DNS
      // rebinding attack relies on). Happy Eyeballs (autoSelectFamily) calls
      // lookup in a different "return all addresses" mode, so it's disabled
      // below and this stays in the classic single-address callback shape.
      lookup: (_hostname, _options, callback) => callback(null, ip, family),
      autoSelectFamily: false,
      port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: params.method,
      headers,
      timeout: REPLAY_TIMEOUT_MS,
      // don't auto-follow redirects — a redirect to a private address
      // would bypass every check above
    };

    const { statusCode, body } = await new Promise<{
      statusCode: number;
      body: string;
    }>((resolve, reject) => {
      const req = transport.request(
        requestOptions,
        (res) => {
          let snippet = "";
          let receivedBytes = 0;
          res.on("data", (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (snippet.length < MAX_RESPONSE_SNIPPET_BYTES) {
              snippet += chunk.toString("utf8");
            }
            if (receivedBytes > MAX_RESPONSE_BYTES) {
              res.destroy(new Error("Response exceeded size limit"));
            }
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: snippet.slice(0, MAX_RESPONSE_SNIPPET_BYTES),
            });
          });
          res.on("error", reject);
        }
      );

      req.on("timeout", () => req.destroy(new Error("Replay request timed out")));
      req.on("error", reject);
      req.write(bodyBuffer);
      req.end();
    });

    return {
      statusCode,
      durationMs: Math.round(performance.now() - start),
      responseSnippet: body,
      error: null,
    };
  } catch (err) {
    return {
      statusCode: null,
      durationMs: Math.round(performance.now() - start),
      responseSnippet: null,
      error: err instanceof SsrfError ? err.message : "Request failed",
    };
  }
}
