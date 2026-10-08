/**
 * @chainwarranty/sdk — public API surface.
 * Re-exports the client and all types.
 */

export { ChainWarrantyClient } from "./client.js";
export type { ChainWarrantyClientOptions } from "./client.js";
export type {
  Claim,
  ClaimStatus,
  ManufacturerInfo,
  ProductToken,
  TokenStatus,
  TransferEvent,
} from "./types.js";
