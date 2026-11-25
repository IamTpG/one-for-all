import type { UpdateKind } from "../../types.ts";

// What every format's parser produces, before the shared cuts and the
// conversion to FeedItem in official/fetch.ts. Type-only, so parsers that
// import it still run under `node --test`.
export type ParsedEntry = {
  /** Stable per-entry key: parsing the same page twice gives the same keys. */
  key: string;
  title: string;
  url: string;
  /** ISO string, or undefined when the entry has no usable date. */
  publishedAt?: string;
  /** "month": the source only gives the month, publishedAt is its 1st. */
  dateApprox?: "month";
  /** Body markup or markdown. bodyFormat says which; unset = sniff it. */
  body?: string;
  bodyFormat?: "html" | "markdown";
  summary?: string;
  categories: string[];
  /** The vendor's own labels for the entry ("Feature", "Model: gpt-6"). */
  labels?: string[];
  /** Set when the source itself says what kind of change this is. */
  kind?: UpdateKind;
};
