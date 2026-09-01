import { createHash, createHmac, timingSafeEqual } from "crypto";

// A single shared secret, not a per-user account system — this app has one
// owner. `wire-owner` is a static bearer token derived from OWNER_SECRET:
// leaking the cookie is equivalent to leaking the secret for as long as
// OWNER_SECRET doesn't change. The only revocation mechanism is rotating
// OWNER_SECRET, which also logs the real owner out.
export const OWNER_COOKIE_NAME = "wire-owner";

function ownerSecret(): string | undefined {
  return process.env.OWNER_SECRET || undefined;
}

// null when OWNER_SECRET isn't configured — every caller must treat that as
// "nobody is the owner," never as "anyone is." Fail closed, not open.
export function computeOwnerToken(): string | null {
  const secret = ownerSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update("wire-owner-token").digest("hex");
}

export function isOwnerRequest(cookieValue: string | undefined): boolean {
  const expected = computeOwnerToken();
  if (!expected || !cookieValue) return false;
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, and cookieValue is attacker-controlled (a visitor can set any
  // string), so length must be checked first.
  if (cookieValue.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected));
}

export function verifySecret(candidate: string): boolean {
  const secret = ownerSecret();
  if (!secret) return false;
  // Hash both sides first so the comparison is always between two
  // fixed-length digests, regardless of the submitted candidate's length.
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

// Machine-to-machine auth for the cron endpoint — a cron trigger (Vercel
// Cron, or an external pinger on tiers/platforms without sub-daily cron)
// isn't a browser request with cookies, so it authenticates with a bearer
// header compared against CRON_SECRET instead.
export function isCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}
