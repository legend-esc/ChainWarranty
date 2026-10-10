/**
 * Freighter-backed signer for use with ChainWarrantyClient.
 *
 * The SDK's state-changing calls accept a Keypair for signing. Because the
 * dashboard must never hold a private key, we instead build the transaction
 * inside the SDK simulation path and then swap the signing step for a
 * Freighter prompt.
 *
 * This module re-implements the `invoke` logic from packages/sdk/client.ts
 * using Freighter, so dashboard code can call it directly without a Keypair.
 */

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
  Transaction,
} from "@stellar/stellar-sdk";

export interface FreighterInvokeOptions {
  rpcUrl: string;
  contractId: string;
  networkPassphrase?: string;
  signerAddress: string;
}

/**
 * Build, simulate, get Freighter signature, and submit a state-changing
 * Soroban transaction. Returns the contract return value (or undefined).
 */
export async function freighterInvoke(
  options: FreighterInvokeOptions,
  operation: xdr.Operation
): Promise<unknown> {
  const passphrase = options.networkPassphrase ?? Networks.TESTNET;
  const server = new SorobanRpc.Server(options.rpcUrl, { allowHttp: false });

  const account = await server.getAccount(options.signerAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // Simulate to get resource footprint
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const preparedXdr = preparedTx.toXDR();

  // Ask Freighter to sign
  // @ts-expect-error — freighter-api browser global
  const freighter = window.freighterApi;
  if (!freighter) {
    throw new Error(
      "Freighter wallet extension is not installed. " +
        "Please install it from https://freighter.app."
    );
  }

  const signResult = await freighter.signTransaction(preparedXdr, {
    networkPassphrase: passphrase,
  });
  if (signResult.error) {
    throw new Error(`Freighter signing failed: ${signResult.error}`);
  }

  const signedTx = new Transaction(signResult.signedTxXdr, passphrase);
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === "ERROR") {
    throw new Error(
      `Transaction failed: ${JSON.stringify(sendResult.errorResult)}`
    );
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(sendResult.hash);
  const maxAttempts = 30;
  let attempts = 0;
  while (
    getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < maxAttempts
  ) {
    await new Promise((r) => setTimeout(r, 1000));
    getResult = await server.getTransaction(sendResult.hash);
    attempts++;
  }

  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction confirmed as failed: ${sendResult.hash}`);
  }
  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
    throw new Error(`Transaction not confirmed after ${maxAttempts}s: ${sendResult.hash}`);
  }

  const success = getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse;
  return success.returnValue ? scValToNative(success.returnValue) : undefined;
}

/** Build the contract call operation for the given function and args. */
export function buildContractOp(
  contractId: string,
  fn: string,
  ...args: xdr.ScVal[]
): xdr.Operation {
  return new Contract(contractId).call(fn, ...args);
}

// Re-export helpers so callers don't need to import from stellar-sdk directly
export { nativeToScVal, xdr, Networks };
