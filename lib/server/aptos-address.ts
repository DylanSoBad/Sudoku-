/** Strict Aptos account address: 0x + 1–64 hex (normalized to 64 later by chain). */
const ADDR_RE = /^0x[a-fA-F0-9]{1,64}$/;

export function parseAptosAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!ADDR_RE.test(trimmed)) return null;
  // Reject trivial / burn-looking short junk beyond the regex.
  if (trimmed === "0x" || trimmed === "0x0") return null;
  return trimmed;
}

export function extractAddressFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  return parseAptosAddress((body as Record<string, unknown>)["address"]);
}
