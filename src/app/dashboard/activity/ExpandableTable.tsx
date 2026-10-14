"use client";

import { type ReactNode, useState } from "react";
import styles from "../Dashboard.module.css";

// A table that shows its first `initial` rows and a "Show all" button for the
// rest. Rows are rendered on the server and passed in as elements.
export default function ExpandableTable({
  head,
  rows,
  initial = 10,
}: {
  head: ReactNode;
  rows: ReactNode[];
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = rows.length - initial;
  const visible = expanded || hidden <= 0 ? rows : rows.slice(0, initial);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>{head}</thead>
          <tbody>{visible}</tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
          <span aria-hidden>{expanded ? "▴" : "▾"}</span>
        </button>
      )}
    </>
  );
}
