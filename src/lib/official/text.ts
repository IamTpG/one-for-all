// Pure text helpers for official bodies. No imports.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function htmlToText(html: string, maxChars: number): string {
  const stripped = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|div|br)>/gi, " ")
    .replace(/<[^>]*>/g, "");
  const decoded = stripped.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
  return decoded.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

// Fits plain text into `max` characters: ends at the last sentence end within
// the limit when that leaves a meaningful chunk (at least a quarter of it),
// otherwise at a word boundary with an ellipsis. Short text is returned as is.
export function clipSummary(text: string, max: number): string {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const window = plain.slice(0, max + 1);
  let end = -1;
  for (const m of window.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) end = m.index + m[0].length;
  if (end >= max / 4) return plain.slice(0, end);
  const cut = plain.slice(0, max - 1);
  // No partial word when the cut already falls between two words.
  const space = plain[max - 1] === " " ? cut.length : cut.lastIndexOf(" ");
  const base = space > max / 2 ? cut.slice(0, space) : cut;
  return base.replace(/[\s,;:.\-–—]+$/, "") + "…";
}

// Cuts raw HTML to at most `maxChars`, backing up to the last complete tag so
// no attribute is cut in half; the sanitizer then closes any open elements.
export function truncateHtml(html: string, maxChars: number): { html: string; truncated: boolean } {
  if (html.length <= maxChars) return { html, truncated: false };
  const cut = html.slice(0, maxChars);
  const lastClose = cut.lastIndexOf(">");
  const lastOpen = cut.lastIndexOf("<");
  return { html: lastOpen > lastClose ? cut.slice(0, lastOpen) : cut, truncated: true };
}

// Plain markdown has no tags; the Codex feed ships some bodies that way.
export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text);
}
