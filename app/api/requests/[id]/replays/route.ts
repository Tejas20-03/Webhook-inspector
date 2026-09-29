import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { replays } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const rows = await db.query.replays.findMany({
    where: eq(replays.requestId, id),
    orderBy: desc(replays.createdAt),
    limit: 20,
  });
  return NextResponse.json({ replays: rows });
}
