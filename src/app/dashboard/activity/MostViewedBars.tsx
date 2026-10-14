export type MostViewedItem = { id: string; title: string; count: number };

// Ranked list with a bar under each title — long titles read better as rows
// than as chart axis labels. The rows spread over the card's height, so the
// card stays balanced next to a taller neighbour.
export default function MostViewedBars({ items }: { items: MostViewedItem[] }) {
  if (items.length === 0) return <p className="px-1 py-6 text-sm text-ink-faint">No article views recorded yet.</p>;
  const max = Math.max(...items.map((item) => item.count));
  return (
    <ol className="m-0 flex flex-1 list-none flex-col justify-evenly gap-3 p-0">
      {items.map((item, i) => (
        <li key={item.id} title={`${item.title}: ${item.count} views`} className="px-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="w-5 shrink-0 font-mono text-xs text-ink-faint">{i + 1}</span>
            <span className="truncate text-ink">{item.title}</span>
            <span className="ml-auto pl-2 font-mono text-xs text-ink-muted">{item.count}</span>
          </div>
          <div className="mt-1.5 ml-7 h-2 overflow-hidden rounded-full border border-line bg-surface-sunken">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
