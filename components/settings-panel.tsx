"use client";

import { useEffect, useState } from "react";

type Settings = {
  responseStatus: number;
  responseBody: string;
  responseContentType: string;
  responseDelayMs: number;
};

export function SettingsPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/endpoints/${slug}/settings`)
      .then((res) => res.json())
      .then((data: Settings) => {
        if (!cancelled) setSettings(data);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/endpoints/${slug}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded bg-white p-6 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Response settings
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        {!settings ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Status code
              <input
                type="number"
                min={100}
                max={599}
                value={settings.responseStatus}
                onChange={(e) =>
                  setSettings({ ...settings, responseStatus: Number(e.target.value) })
                }
                className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Content-Type
              <input
                value={settings.responseContentType}
                onChange={(e) =>
                  setSettings({ ...settings, responseContentType: e.target.value })
                }
                className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Response body
              <textarea
                rows={5}
                value={settings.responseBody}
                onChange={(e) => setSettings({ ...settings, responseBody: e.target.value })}
                className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-xs dark:border-zinc-700"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Artificial delay (ms, max 10000) — useful for testing the sender&apos;s retry
              behavior
              <input
                type="number"
                min={0}
                max={10000}
                value={settings.responseDelayMs}
                onChange={(e) =>
                  setSettings({ ...settings, responseDelayMs: Number(e.target.value) })
                }
                className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
