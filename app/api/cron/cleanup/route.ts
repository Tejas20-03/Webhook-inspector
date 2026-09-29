import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { endpoints, requests } from "@/lib/db/schema";
import { cleanupRateLimits } from "@/lib/rate-limit";

export const runtime = "nodejs";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const requestCutoff = new Date(now.getTime() - REQUEST_TTL_MS);

  const [deletedEndpoints, deletedRequests] = await Promise.all([
    // cascades to that endpoint's requests and replays
    db.delete(endpoints).where(lt(endpoints.expiresAt, now)).returning({ id: endpoints.id }),
    db
      .delete(requests)
      .where(lt(requests.receivedAt, requestCutoff))
      .returning({ id: requests.id }),
  ]);

  await cleanupRateLimits();

  return NextResponse.json({
    expiredEndpoints: deletedEndpoints.length,
    prunedRequests: deletedRequests.length,
  });
}

