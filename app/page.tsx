"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createEndpoint() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/endpoints", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create endpoint");
      const { slug } = await res.json();
      router.push(`/d/${slug}`);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Webhook Inspector
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Get a unique URL that captures every request sent to it. Inspect
          headers and bodies, replay requests, and verify signatures &mdash;
          no signup required.
        </p>
        <button
          onClick={createEndpoint}
          disabled={loading}
          data-testid="create-endpoint"
          className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Creating..." : "Create an endpoint"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </main>
    </div>
  );
}
