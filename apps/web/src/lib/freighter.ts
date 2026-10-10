/**
 * Freighter wallet integration helpers.
 *
 * Wraps the @stellar/freighter-api browser extension API so dashboard
 * components can request the connected address and sign transactions
 * without holding any private key in the web app.
 *
 * Falls back gracefully when Freighter is not installed.
 */

/** Returns the connected Stellar public key, or null if not connected. */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    // @ts-expect-error — freighter-api is a browser global injected by the extension
    const freighter = window.freighterApi ?? (await import("@stellar/freighter-api").catch(() => null));
    if (!freighter) return null;
    const { address } = await freighter.getAddress();
    return address ?? null;
  } catch {
    return null;
  }
}

/** Returns true if the Freighter extension is installed and accessible. */
export async function isFreighterAvailable(): Promise<boolean> {
  try {
    // @ts-expect-error
    return typeof window !== "undefined" && !!window.freighterApi;
  } catch {
    return false;
  }
}

/**
 * Signs an XDR-encoded transaction envelope with Freighter and returns the
 * signed XDR string, or throws with a user-friendly message on failure.
 */
export async function signWithFreighter(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  // @ts-expect-error
  const freighter = window.freighterApi;
  if (!freighter) {
    throw new Error(
      "Freighter wallet extension is not installed. " +
        "Please install it from https://freighter.app and try again."
    );
  }
  const result = await freighter.signTransaction(xdr, { networkPassphrase });
  if (result.error) {
    throw new Error(`Freighter signing failed: ${result.error}`);
  }
  return result.signedTxXdr;
}
