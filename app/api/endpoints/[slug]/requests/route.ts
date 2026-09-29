import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { endpoints, requests } from "@/lib/db/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.slug, slug),
  });

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const rows = await db.query.requests.findMany({
    where: since
      ? and(eq(requests.endpointId, endpoint.id), gt(requests.receivedAt, since))
      : eq(requests.endpointId, endpoint.id),
    orderBy: desc(requests.receivedAt),
    limit: 200,
  });

  return NextResponse.json({ requests: rows });
}
