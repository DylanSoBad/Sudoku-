/**
 * Shared Shelby wire details, used by the browser client, the `/api/blob`
 * route, and the seeding scripts. Keeping them together stops the three call
 * sites from drifting apart, which is exactly how the earlier "uploads silently
 * skipped" bug survived so long.
 */

/**
 * Shelby contract deployer on shelbynet. The SDK ships its own default, which
 * has lagged behind redeployments; passing this explicitly makes the client
 * resolve `blob_metadata` against the live contract.
 * Source: https://docs.shelby.xyz/protocol/architecture/networks
 */
export const SHELBY_DEPLOYER =
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

/** Only activated storage location on shelbynet today. */
export const SHELBY_LOCATION = "shelbynet-1";

export const SHELBY_RPC_URL = "https://api.shelbynet.shelby.xyz/shelby";
export const SHELBY_FULLNODE_URL = "https://api.shelbynet.shelby.xyz/v1";
export const SHELBY_INDEXER_URL =
  "https://api.shelbynet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql";

/**
 * `client.download` resolves to a `ShelbyBlob`, whose payload is a
 * `ReadableStream` rather than a byte array. Older SDK builds returned bytes
 * directly, so both shapes are accepted.
 */
export async function readShelbyBlob(out: unknown): Promise<Uint8Array | null> {
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (!out || typeof out !== "object") return null;

  const rec = out as Record<string, unknown>;

  const readable = rec["readable"];
  if (readable && typeof (readable as ReadableStream).getReader === "function") {
    return drain(readable as ReadableStream<Uint8Array>);
  }

  for (const key of ["data", "bytes", "blobData"]) {
    const v = rec[key];
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
  }

  if (typeof rec["arrayBuffer"] === "function") {
    const buf = await (rec["arrayBuffer"] as () => Promise<ArrayBuffer>)();
    return new Uint8Array(buf);
  }

  return null;
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
