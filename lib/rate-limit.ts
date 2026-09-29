import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

const WINDOW_MS = 60_000;

export type RateLimitResult = { allowed: boolean; remaining: number; limit: number };

/**
 * Fixed-window counter backed by Postgres. Each (key, windowStart) row is
 * upserted atomically, so concurrent requests can't race past the limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}

export async function cleanupRateLimits(olderThanMs: number = WINDOW_MS * 5) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${cutoff}`);
}
