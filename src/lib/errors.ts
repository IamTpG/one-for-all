// AggregateError (thrown by fetch when both IPv4 and IPv6 connection
// attempts fail) has an empty .message by default — the real detail is in
// .errors[], one per attempt — so it needs unwrapping instead of just
// reading .message like every other Error.
export function errorMessage(err: unknown): string {
  if (err instanceof AggregateError) {
    const sub = err.errors.map((e) => errorMessage(e)).filter(Boolean);
    return sub.length > 0 ? sub.join("; ") : err.message || "Unknown aggregate error";
  }
  if (err instanceof Error) {
    return err.message || err.name;
  }
  return String(err);
}
