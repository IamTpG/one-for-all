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
