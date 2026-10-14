export type KeyItem = { label: string; color: string; shape: "bar" | "line" | "dash" | "dot" };

function Swatch({ color, shape }: Pick<KeyItem, "color" | "shape">) {
  if (shape === "dot") return <span className="size-2 rounded-full" style={{ background: color }} />;
  if (shape === "bar") return <span className="size-2.5 rounded-[3px]" style={{ background: color }} />;
  return (
    <span
      className="w-4 border-t-2"
      style={{ borderColor: color, borderTopStyle: shape === "dash" ? "dashed" : "solid" }}
    />
  );
}

// What each colour, line and marker in a chart means, drawn as the marks themselves.
export default function ChartKey({ items }: { items: KeyItem[] }) {
  return (
    <ul className="mb-1 flex min-h-5 flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} shape={item.shape} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
