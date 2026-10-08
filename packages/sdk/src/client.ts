/**
 * ChainWarrantyClient — thin TypeScript wrapper around the Soroban registry contract.
 *
 * Exposes exactly the 11 functions listed in README.md's "Contract reference" table.
 * Uses @stellar/stellar-sdk for RPC calls, per README.md's Tech stack table.
 *
 * All state-changing calls require a `Keypair` (the transaction source/signer).
 * Read-only calls (verify, get_history, get_claims) need no keypair.
 */

import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

import type { Claim, ManufacturerInfo, ProductToken, TransferEvent } from "./types.js";

export interface ChainWarrantyClientOptions {
  /** Soroban RPC endpoint URL. */
  rpcUrl: string;
  /** Deployed contract ID (Strkey C… format). */
  contractId: string;
  /** Stellar network passphrase. Defaults to testnet. */
  networkPassphrase?: string;
}

/**
 * Maps raw ScVal output from the contract into a typed ProductToken.
 */
function decodeProductToken(raw: unknown): ProductToken {
  const obj = raw as Record<string, unknown>;
  return {
    serial_hash: Buffer.from(obj["serial_hash"] as Uint8Array).toString("hex"),
    product_id: obj["product_id"] as string,
    manufacturer: obj["manufacturer"] as string,
    mint_ts: Number(obj["mint_ts"]),
    warranty_months: Number(obj["warranty_months"]),
    owner: obj["owner"] as string,
    status: (obj["status"] as string) === "Voided" ? "Voided" : "Active",
    transfer_count: Number(obj["transfer_count"]),
  };
}

function decodeTransferEvent(raw: unknown): TransferEvent {
  const obj = raw as Record<string, unknown>;
  return {
    from: obj["from"] as string,
    to: obj["to"] as string,
    ts: Number(obj["ts"]),
  };
}

function decodeClaim(raw: unknown): Claim {
  const obj = raw as Record<string, unknown>;
  const statusRaw = obj["status"] as string;
  const status =
    statusRaw === "Approved"
      ? "Approved"
      : statusRaw === "Rejected"
      ? "Rejected"
      : "Filed";
  return {
    claimant: obj["claimant"] as string,
    ts: Number(obj["ts"]),
    description: obj["description"] as string,
    status,
  };
}

export class ChainWarrantyClient {
  private readonly server: SorobanRpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;
  private readonly contractId: string;

  constructor(options: ChainWarrantyClientOptions) {
    this.server = new SorobanRpc.Server(options.rpcUrl, { allowHttp: false });
    this.contract = new Contract(options.contractId);
    this.contractId = options.contractId;
    this.networkPassphrase =
      options.networkPassphrase ?? Networks.TESTNET;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build, simulate, and submit a state-changing transaction. Returns the ledger result. */
  private async invoke(
    keypair: Keypair,
    operation: xdr.Operation
  ): Promise<unknown> {
    const account = await this.server.getAccount(keypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate to get resource footprint
    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(keypair);

    const sendResult = await this.server.sendTransaction(preparedTx);
    if (sendResult.status === "ERROR") {
      throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    // Poll for confirmation
    let getResult = await this.server.getTransaction(sendResult.hash);
    while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      await new Promise((r) => setTimeout(r, 1000));
      getResult = await this.server.getTransaction(sendResult.hash);
    }

    if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction confirmed as failed: ${sendResult.hash}`);
    }

    const successResult = getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse;
    return successResult.returnValue ? scValToNative(successResult.returnValue) : undefined;
  }

  /** Call a read-only contract function via simulateTransaction (no signing needed). */
  private async query(operation: xdr.Operation): Promise<unknown> {
    const account = new (await import("@stellar/stellar-sdk")).Account(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "0"
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Query failed: ${simResult.error}`);
    }
    const successSim = simResult as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    return successSim.result ? scValToNative(successSim.result.retval) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Write functions (require keypair / wallet signing)
  // ---------------------------------------------------------------------------

  /**
   * Sets the contract admin. Can only be called once.
   * Caller: anyone (first caller becomes admin).
   */
  async initialize(signer: Keypair, admin: string): Promise<void> {
    const op = this.contract.call(
      "initialize",
      nativeToScVal(admin, { type: "address" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Whitelists an address to mint tokens.
   * Caller: admin.
   */
  async addManufacturer(
    signer: Keypair,
    manufacturer: string,
    name: string
  ): Promise<void> {
    const op = this.contract.call(
      "add_manufacturer",
      nativeToScVal(manufacturer, { type: "address" }),
      nativeToScVal(name, { type: "string" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Suspends or reinstates a manufacturer without removing its history.
   * Caller: admin.
   */
  async setManufacturerActive(
    signer: Keypair,
    manufacturer: string,
    active: boolean
  ): Promise<void> {
    const op = this.contract.call(
      "set_manufacturer_active",
      nativeToScVal(manufacturer, { type: "address" }),
      nativeToScVal(active, { type: "bool" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Mints one token for a physical serial number.
   * Caller: whitelisted manufacturer.
   * @param serialHash 32-byte Uint8Array — sha256(serial_number)
   */
  async mintToken(
    signer: Keypair,
    manufacturer: string,
    serialHash: Uint8Array,
    productId: string,
    warrantyMonths: number,
    initialOwner: string
  ): Promise<void> {
    const op = this.contract.call(
      "mint_token",
      nativeToScVal(manufacturer, { type: "address" }),
      xdr.ScVal.scvBytes(Buffer.from(serialHash)),
      nativeToScVal(productId, { type: "string" }),
      nativeToScVal(warrantyMonths, { type: "u32" }),
      nativeToScVal(initialOwner, { type: "address" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Transfers ownership of a token to a new Stellar address.
   * Caller: current owner.
   * @param serialHash 32-byte Uint8Array
   */
  async transferOwnership(
    signer: Keypair,
    serialHash: Uint8Array,
    newOwner: string
  ): Promise<void> {
    const op = this.contract.call(
      "transfer_ownership",
      xdr.ScVal.scvBytes(Buffer.from(serialHash)),
      nativeToScVal(newOwner, { type: "address" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Opens a warranty claim for a token.
   * Caller: current owner.
   * Fails if the token is voided or warranty has expired.
   */
  async fileClaim(
    signer: Keypair,
    serialHash: Uint8Array,
    description: string
  ): Promise<void> {
    const op = this.contract.call(
      "file_claim",
      xdr.ScVal.scvBytes(Buffer.from(serialHash)),
      nativeToScVal(description, { type: "string" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Approves or rejects a filed warranty claim.
   * Caller: the token's manufacturer.
   * @param claimId The `ts` field of the Claim (used as identifier).
   */
  async resolveClaim(
    signer: Keypair,
    serialHash: Uint8Array,
    claimId: number,
    approved: boolean
  ): Promise<void> {
    const op = this.contract.call(
      "resolve_claim",
      xdr.ScVal.scvBytes(Buffer.from(serialHash)),
      nativeToScVal(claimId, { type: "u64" }),
      nativeToScVal(approved, { type: "bool" })
    );
    await this.invoke(signer, op);
  }

  /**
   * Marks a token as counterfeit or recalled. Blocks further transfers and claims.
   * Caller: the token's manufacturer.
   */
  async voidToken(
    signer: Keypair,
    serialHash: Uint8Array,
    reason: string
  ): Promise<void> {
    const op = this.contract.call(
      "void_token",
      xdr.ScVal.scvBytes(Buffer.from(serialHash)),
      nativeToScVal(reason, { type: "string" })
    );
    await this.invoke(signer, op);
  }

  // ---------------------------------------------------------------------------
  // Read-only functions (no keypair needed)
  // ---------------------------------------------------------------------------

  /**
   * Returns the full ProductToken record for the given serial hash.
   * Throws `TokenNotFound` if no token exists.
   */
  async verify(serialHash: Uint8Array): Promise<ProductToken> {
    const op = this.contract.call(
      "verify",
      xdr.ScVal.scvBytes(Buffer.from(serialHash))
    );
    const raw = await this.query(op);
    return decodeProductToken(raw);
  }

  /**
   * Returns the ownership transfer history for a token.
   */
  async getHistory(serialHash: Uint8Array): Promise<TransferEvent[]> {
    const op = this.contract.call(
      "get_history",
      xdr.ScVal.scvBytes(Buffer.from(serialHash))
    );
    const raw = (await this.query(op)) as unknown[];
    return (raw ?? []).map(decodeTransferEvent);
  }

  /**
   * Returns all warranty claims filed for a token.
   */
  async getClaims(serialHash: Uint8Array): Promise<Claim[]> {
    const op = this.contract.call(
      "get_claims",
      xdr.ScVal.scvBytes(Buffer.from(serialHash))
    );
    const raw = (await this.query(op)) as unknown[];
    return (raw ?? []).map(decodeClaim);
  }

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  /** Returns whether a token's warranty is still active at the given Unix timestamp. */
  static isWarrantyActive(token: ProductToken, nowSeconds: number): boolean {
    const expiresAt =
      token.mint_ts + token.warranty_months * 30 * 24 * 60 * 60;
    return nowSeconds <= expiresAt;
  }

  /** Returns the contract ID this client is configured for. */
  get id(): string {
    return this.contractId;
  }
}
