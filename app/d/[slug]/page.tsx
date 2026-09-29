import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
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

  return <Dashboard slug={slug} />;
}
