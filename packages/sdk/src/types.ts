/**
 * Data model types matching the contract's "Data model" section in README.md.
 * All types are plain objects; no Soroban-internal types leak through this layer.
 */

/** Status of a minted product token. */
export type TokenStatus = "Active" | "Voided";

/** Status of a warranty claim. */
export type ClaimStatus = "Filed" | "Approved" | "Rejected";

/**
 * The on-chain record for a single physical product.
 * Matches the `ProductToken` struct in the contract reference.
 */
export interface ProductToken {
  /** SHA-256 hash of the real serial number (hex string). */
  serial_hash: string;
  /** Manufacturer-assigned product identifier string. */
  product_id: string;
  /** Stellar address of the manufacturer that minted this token. */
  manufacturer: string;
  /** Unix timestamp (seconds) of the mint call. */
  mint_ts: number;
  /** Warranty duration in months (30-day months, matching contract math). */
  warranty_months: number;
  /** Stellar address of the current owner. */
  owner: string;
  /** Active or Voided. */
  status: TokenStatus;
  /** Number of ownership transfers since mint. */
  transfer_count: number;
}

/**
 * One entry in the ownership transfer history.
 * Matches the `TransferEvent` struct in the contract reference.
 */
export interface TransferEvent {
  /** Stellar address of the previous owner. */
  from: string;
  /** Stellar address of the new owner. */
  to: string;
  /** Unix timestamp (seconds) of the transfer. */
  ts: number;
}

/**
 * A warranty claim filed by the current owner.
 * Matches the `Claim` struct in the contract reference.
 */
export interface Claim {
  /** Stellar address of the owner who filed the claim. */
  claimant: string;
  /** Unix timestamp (seconds) when the claim was filed. */
  ts: number;
  /** Free-text description provided by the claimant. */
  description: string;
  /** Current processing status of this claim. */
  status: ClaimStatus;
}

/** Manufacturer record as stored in the contract whitelist. */
export interface ManufacturerInfo {
  address: string;
  name: string;
  active: boolean;
}
