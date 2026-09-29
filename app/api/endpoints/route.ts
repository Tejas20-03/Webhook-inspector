import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { endpoints } from "@/lib/db/schema";
import { generateSlug } from "@/lib/slug";

const OWNER_COOKIE = "wh_owner";
const ANON_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  let owner = req.cookies.get(OWNER_COOKIE)?.value;
  if (!owner) owner = randomUUID();

  const [endpoint] = await db
    .insert(endpoints)
    .values({
      slug: generateSlug(),
      owner,
      expiresAt: new Date(Date.now() + ANON_TTL_MS),
    })
    .returning();

  const res = NextResponse.json({ slug: endpoint.slug });
  res.cookies.set(OWNER_COOKIE, owner, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
