import { diffLines } from "diff";

export type DiffRow = {
  left: string | null;
  right: string | null;
  type: "same" | "removed" | "added" | "changed";
};

/**
 * Line-based diff aligned into two columns. Consecutive removed/added blocks
 * (i.e. a changed line) are zipped row-by-row so the old and new version of
 * a line sit side by side instead of stacking as separate remove/add blocks.
 */
export function computeSideBySideDiff(a: string, b: string): DiffRow[] {
  const parts = diffLines(a, b);
  const rows: DiffRow[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    const next = parts[i + 1];

    if (part.removed && next?.added) {
      const removedLines = splitLines(part.value);
      const addedLines = splitLines(next.value);
      const max = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < max; j++) {
        rows.push({
          left: removedLines[j] ?? null,
          right: addedLines[j] ?? null,
          type: "changed",
        });
      }
      i += 2;
      continue;
    }

    const lines = splitLines(part.value);
    if (part.added) {
      for (const line of lines) rows.push({ left: null, right: line, type: "added" });
    } else if (part.removed) {
      for (const line of lines) rows.push({ left: line, right: null, type: "removed" });
    } else {
      for (const line of lines) rows.push({ left: line, right: line, type: "same" });
    }
    i++;
  }

  return rows;
}

function splitLines(value: string): string[] {
  return value.replace(/\n$/, "").split("\n");
}
