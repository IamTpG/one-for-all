# Vendored charts (Bklit UI)

Source: Bklit UI shadcn registry (`https://bklit.com/r/{name}.json`), MIT licensed.
Copied in with:

```
npx shadcn@latest add @bklit/gauge-chart @bklit/ring-chart @bklit/pie-chart \
  @bklit/line-chart @bklit/area-chart @bklit/bar-chart @bklit/composed-chart \
  @bklit/heatmap-chart @bklit/funnel-chart @bklit/sankey-chart --yes --overwrite
```

We own this source. Do not restyle it in place; theming comes from the
`--chart-*` variables in `src/app/dashboard/dashboard.css`.

## Local patches

`local-patches.patch` holds our changes to upstream files. Re-apply it after
updating (from this directory): `patch -p1 < local-patches.patch`.

- `chart-loading-label.tsx`: wrong relative import of `shimmering-text`
  (`../components/shimmering-text` -> `../shimmering-text`).
- `chart-stat-flow.tsx`: hydration mismatch (server rendered plain text, the
  client's first render used `<number-flow-react>`); readiness now comes from
  `useSyncExternalStore` with a `false` server snapshot.
- `sankey/sankey-node.tsx`: the value label hard-coded "sessions"; added a
  `valueUnit` prop (default still "sessions").

## Using them

- Gauge: set `minWidth={0}` (default 300px overflows narrow cards).
- Sankey: the default margins are 180px left and right; pass a smaller
  `margin` for narrow containers and give it a full-width card.
- `shadcn add` also rewrites `src/app/dashboard/dashboard.css` and
  `src/lib/utils.ts`; restore ours afterwards (`git checkout` the files).
