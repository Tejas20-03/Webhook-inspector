import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requests, replays } from "@/lib/db/schema";
import { replayRequest } from "@/lib/replay";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const REPLAY_LIMIT_PER_MIN = 20;

const bodySchema = z.object({
  targetUrl: z.string().min(1).max(2048),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const ip = getClientIp(req);
  const limit = await checkRateLimit(`replay:${ip ?? "unknown"}`, REPLAY_LIMIT_PER_MIN);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { "retry-after": "60" } }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  }

  const original = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  if (!original) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const result = await replayRequest({
    targetUrl: parsed.data.targetUrl,
    method: original.method,
    headers: original.headers as Record<string, string>,
    body: original.body,
    bodyEncoding: original.bodyEncoding as "utf8" | "base64",
  });

  const [replay] = await db
    .insert(replays)
    .values({
      requestId: original.id,
      targetUrl: parsed.data.targetUrl,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      responseSnippet: result.responseSnippet,
      error: result.error,
    })
    .returning();

  return NextResponse.json({ replay });
}
