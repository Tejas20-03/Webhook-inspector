import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { endpoints } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_DELAY_MS = 10_000;
const MAX_BODY_LEN = 100_000;

const settingsSchema = z.object({
  responseStatus: z.number().int().min(100).max(599),
  responseBody: z.string().max(MAX_BODY_LEN),
  responseContentType: z.string().min(1).max(200),
  responseDelayMs: z.number().int().min(0).max(MAX_DELAY_MS),
});

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const endpoint = await db.query.endpoints.findFirst({ where: eq(endpoints.slug, slug) });
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }
  return NextResponse.json({
    responseStatus: endpoint.responseStatus,
    responseBody: endpoint.responseBody,
    responseContentType: endpoint.responseContentType,
    responseDelayMs: endpoint.responseDelayMs,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }

  const [updated] = await db
    .update(endpoints)
    .set(parsed.data)
    .where(eq(endpoints.slug, slug))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  return NextResponse.json({
    responseStatus: updated.responseStatus,
    responseBody: updated.responseBody,
    responseContentType: updated.responseContentType,
    responseDelayMs: updated.responseDelayMs,
  });
}
