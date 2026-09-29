"use client";

import type { CapturedRequest } from "@/lib/types";
import { prettyBody, METHOD_COLORS } from "@/lib/format";
import { computeSideBySideDiff } from "@/lib/diff";

const ROW_BG: Record<string, string> = {
  removed: "bg-red-50 dark:bg-red-950/40",
  added: "bg-green-50 dark:bg-green-950/40",
  changed: "bg-amber-50 dark:bg-amber-950/40",
  same: "",
};

function HeaderLabel({ req }: { req: CapturedRequest }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${METHOD_COLORS[req.method] ?? "bg-zinc-100 text-zinc-700"}`}
      >
        {req.method}
      </span>
      <span className="font-mono text-zinc-700 dark:text-zinc-300">{req.path}</span>
      <span className="text-xs text-zinc-400">
        {new Date(req.receivedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

function HeadersDiff({ a, b }: { a: CapturedRequest; b: CapturedRequest }) {
  const keys = Array.from(new Set([...Object.keys(a.headers), ...Object.keys(b.headers)])).sort();

  return (
    <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
      {keys.map((key) => {
        const va = a.headers[key];
        const vb = b.headers[key];
        const same = va === vb;
        return (
          <div
            key={key}
            className={`grid grid-cols-2 gap-2 border-b border-zinc-100 px-3 py-1.5 text-xs last:border-0 dark:border-zinc-900 ${
              same ? "" : "bg-amber-50 dark:bg-amber-950/40"
            }`}
          >
            <div className="truncate">
              <span className="font-medium text-zinc-500">{key}: </span>
              <span className="break-all text-zinc-700 dark:text-zinc-300">{va ?? "—"}</span>
            </div>
            <div className="truncate">
              <span className="font-medium text-zinc-500">{key}: </span>
              <span className="break-all text-zinc-700 dark:text-zinc-300">{vb ?? "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BodyDiff({ a, b }: { a: CapturedRequest; b: CapturedRequest }) {
  const rows = computeSideBySideDiff(prettyBody(a), prettyBody(b));

  return (
    <div className="overflow-x-auto rounded border border-zinc-200 font-mono text-xs dark:border-zinc-800">
      {rows.map((row, i) => (
        <div key={i} className={`grid grid-cols-2 ${ROW_BG[row.type]}`}>
          <div className="truncate whitespace-pre border-r border-zinc-100 px-3 py-0.5 dark:border-zinc-900">
            {row.left ?? ""}
          </div>
          <div className="truncate whitespace-pre px-3 py-0.5">{row.right ?? ""}</div>
        </div>
      ))}
    </div>
  );
}

export function DiffView({ a, b }: { a: CapturedRequest; b: CapturedRequest }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <HeaderLabel req={a} />
        <HeaderLabel req={b} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-500">Headers</h3>
        <HeadersDiff a={a} b={b} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-500">Body</h3>
        <BodyDiff a={a} b={b} />
      </div>
    </div>
  );
}
