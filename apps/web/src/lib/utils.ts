/**
 * Client-side SHA-256 helper.
 * Hashes the raw serial number using the Web Crypto API so the raw serial
 * never leaves the customer's device except inside the URL itself
 * (per README.md's QR code format section).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Compute warranty expiry Unix timestamp (seconds) using the same
 * 30-day-month math as the Soroban contract.
 */
export function warrantyExpiresAt(mintTs: number, warrantyMonths: number): number {
  return mintTs + warrantyMonths * 30 * 24 * 60 * 60;
}

/**
 * Returns whether the warranty is still active at the given Unix timestamp (seconds).
 */
export function isWarrantyActive(mintTs: number, warrantyMonths: number, nowSeconds: number): boolean {
  return nowSeconds <= warrantyExpiresAt(mintTs, warrantyMonths);
}

/**
 * Format a Unix timestamp (seconds) as a human-readable local date string.
 */
export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Truncate a Stellar address for display: G...XXXX
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
