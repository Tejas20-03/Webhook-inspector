import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { endpoints, requests } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const MAX_DELAY_MS = 10_000; // cap artificial delay so slots can't be tied up forever

function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

function decodeBody(buf: ArrayBuffer): { body: string; encoding: "utf8" | "base64" } {
  const bytes = new Uint8Array(buf);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { body: text, encoding: "utf8" };
  } catch {
    return { body: Buffer.from(bytes).toString("base64"), encoding: "base64" };
  }
}

async function handle(req: NextRequest, slug: string) {
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.slug, slug),
  });

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const rawBody = await req.arrayBuffer();

  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Body too large. Max ${MAX_BODY_BYTES} bytes.` },
      { status: 413 }
    );
  }

  const { body, encoding } = decodeBody(rawBody);
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());

  await db.insert(requests).values({
    endpointId: endpoint.id,
    method: req.method,
    path: req.nextUrl.pathname,
    query,
    headers,
    body,
    bodyEncoding: encoding,
    bodySize: rawBody.byteLength,
    contentType: req.headers.get("content-type"),
    ip: getClientIp(req),
  });

  const delay = Math.min(endpoint.responseDelayMs, MAX_DELAY_MS);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return new NextResponse(endpoint.responseBody, {
    status: endpoint.responseStatus,
    headers: { "content-type": endpoint.responseContentType },
  });
}

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handle(req, (await params).slug);
}
export async function POST(req: NextRequest, { params }: Params) {
  return handle(req, (await params).slug);
}
export async function PUT(req: NextRequest, { params }: Params) {
  return handle(req, (await params).slug);
}
export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, (await params).slug);
}
export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, (await params).slug);
}
