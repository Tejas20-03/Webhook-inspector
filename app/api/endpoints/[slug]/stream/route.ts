import { NextRequest } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { endpoints, requests } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 1000;
const HEARTBEAT_MS = 15_000;
// End the stream well before a serverless platform's function timeout would
// kill it uncleanly. EventSource auto-reconnects using Last-Event-ID, so this
// is invisible to the client beyond a brief gap.
const MAX_CONNECTION_MS = 25_000;

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.slug, slug),
  });

  if (!endpoint) {
    return new Response("Endpoint not found", { status: 404 });
  }

  const lastEventId = req.headers.get("last-event-id");
  // On a fresh connect (no Last-Event-ID yet) back-date slightly to close the
  // gap between page load and the stream actually opening.
  let cursor = lastEventId ? new Date(lastEventId) : new Date(Date.now() - 5000);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(endTimer);
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting
        }
      };

      const poll = async () => {
        if (closed) return;
        let rows;
        try {
          rows = await db.query.requests.findMany({
            where: and(
              eq(requests.endpointId, endpoint.id),
              gt(requests.receivedAt, cursor)
            ),
            orderBy: asc(requests.receivedAt),
            limit: 200,
          });
        } catch {
          return; // transient DB hiccup, retry on the next tick
        }

        for (const row of rows) {
          cursor = row.receivedAt;
          const chunk = `id: ${row.receivedAt.toISOString()}\nevent: request\ndata: ${JSON.stringify(row)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
      };

      const pollTimer = setInterval(poll, POLL_MS);
      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, HEARTBEAT_MS);
      const endTimer = setTimeout(close, MAX_CONNECTION_MS);

      req.signal.addEventListener("abort", close);
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
