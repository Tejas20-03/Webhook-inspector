import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import {
  verifyGithubSignature,
  verifyStripeSignature,
  verifyTwilioSignature,
} from "@/lib/signature-verify";

export const runtime = "nodejs";

const bodySchema = z.object({
  provider: z.enum(["stripe", "github", "twilio"]),
  secret: z.string().min(1).max(512),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "provider and secret are required" }, { status: 400 });
  }
  const { provider, secret } = parsed.data;

  const row = await db.query.requests.findFirst({ where: eq(requests.id, id) });
  if (!row) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (row.bodyEncoding === "base64") {
    return NextResponse.json({
      valid: false,
      reason: "Signature verification isn't supported for binary bodies",
    });
  }

  const headers = row.headers as Record<string, string>;
  const rawBody = row.body;

  let result;
  switch (provider) {
    case "stripe":
      result = verifyStripeSignature(headers["stripe-signature"], rawBody, secret);
      break;
    case "github":
      result = verifyGithubSignature(headers["x-hub-signature-256"], rawBody, secret);
      break;
    case "twilio": {
      const proto = headers["x-forwarded-proto"] ?? "https";
      const query = new URLSearchParams(row.query as Record<string, string>).toString();
      const fullUrl = `${proto}://${headers["host"] ?? ""}${row.path}${query ? `?${query}` : ""}`;
      const formParams = Object.fromEntries(new URLSearchParams(rawBody).entries());
      result = verifyTwilioSignature(headers["x-twilio-signature"], fullUrl, formParams, secret);
      break;
    }
  }

  return NextResponse.json(result);
}
