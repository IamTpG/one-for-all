// Pure helpers for conditional GET (ETag / Last-Modified) on official
// sources. No imports, so they run under `node --test`.

// Bump when a parser or the selection rules change: a stored validator from
// before would otherwise answer 304 and keep the new code from ever seeing
// the page.
export const VALIDATOR_REVISION = 1;

export type SourceValidator = {
  etag?: string;
  lastModified?: string;
  // What the validator was saved under (see validatorSignature). A 304 only
  // means "nothing changed" for the settings in force when it was saved.
  signature: string;
};

const MAX_VALIDATOR_LENGTH = 512;

// Header values are echoed back to the server, so only plain printable
// ASCII is accepted (no control characters, no line breaks).
function cleanHeaderValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VALIDATOR_LENGTH) return undefined;
  return /^[\x20-\x7e]+$/.test(trimmed) ? trimmed : undefined;
}

// Changing the item limit or the lookback changes what a full fetch would
// return, so a stored validator no longer applies.
export function validatorSignature(opts: { limit: number; lookbackDays: number }): string {
  return `v${VALIDATOR_REVISION}:${opts.limit}:${opts.lookbackDays}`;
}

export function validatorFromHeaders(
  headers: { get(name: string): string | null },
  signature: string
): SourceValidator | undefined {
  const etag = cleanHeaderValue(headers.get("etag"));
  const lastModified = cleanHeaderValue(headers.get("last-modified"));
  if (!etag && !lastModified) return undefined;
  return { ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}), signature };
}

// Reads one stored value defensively: anything that is not a well-formed
// validator is treated as absent.
export function coerceValidator(raw: unknown): SourceValidator | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const etag = cleanHeaderValue(record.etag);
  const lastModified = cleanHeaderValue(record.lastModified);
  if (typeof record.signature !== "string" || (!etag && !lastModified)) return null;
  return { ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}), signature: record.signature };
}

// The request headers for a stored validator; empty when there is none or it
// was saved under different settings.
export function conditionalHeaders(
  validator: SourceValidator | undefined,
  signature: string
): Record<string, string> {
  if (!validator || validator.signature !== signature) return {};
  return {
    ...(validator.etag ? { "If-None-Match": validator.etag } : {}),
    ...(validator.lastModified ? { "If-Modified-Since": validator.lastModified } : {}),
  };
}
