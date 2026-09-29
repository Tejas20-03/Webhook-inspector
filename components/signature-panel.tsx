"use client";

import { useState } from "react";

type Provider = "stripe" | "github" | "twilio";

const PROVIDER_LABELS: Record<Provider, string> = {
  stripe: "Stripe",
  github: "GitHub",
  twilio: "Twilio",
};

export function SignaturePanel({ requestId }: { requestId: string }) {
  const [provider, setProvider] = useState<Provider>("stripe");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<{ valid: boolean; reason: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function verify() {
    if (!secret.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/verify-signature`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, secret }),
      });
      const data = await res.json();
      setResult(res.ok ? data : { valid: false, reason: data.error ?? "Verification failed" });
    } catch {
      setResult({ valid: false, reason: "Verification failed" });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        >
          {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
            <option key={p} value={p} className="dark:bg-zinc-900">
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={
            provider === "stripe"
              ? "whsec_..."
              : provider === "github"
                ? "webhook secret"
                : "Twilio auth token"
          }
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          onClick={verify}
          disabled={checking || !secret.trim()}
          className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {checking ? "Checking..." : "Verify"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded p-3 text-sm ${
            result.valid
              ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.valid ? "Valid signature" : `Invalid — ${result.reason}`}
        </div>
      )}

      <p className="text-xs text-zinc-400">
        The secret is only used for this one check and is never stored.
      </p>
    </div>
  );
}
