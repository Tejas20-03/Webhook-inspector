import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { endpoints } from "@/lib/db/schema";
import { Dashboard } from "@/components/dashboard";

type Params = { params: Promise<{ slug: string }> };

export default async function EndpointPage({ params }: Params) {
  const { slug } = await params;
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.slug, slug),
  });

  if (!endpoint) notFound();

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = hdrs.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  const ingestUrl = `${proto}://${host}/h/${slug}`;

  return <Dashboard slug={slug} ingestUrl={ingestUrl} />;
}
