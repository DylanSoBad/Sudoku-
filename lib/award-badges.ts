/**
 * Award milestone badges after level complete — local record + optional Move mint.
 */

import {
  badgeMetadataPayload,
  milestonesForLevel,
  recordBadge,
  type BadgeDef,
} from "@/lib/badges";
import { buildMintBadgePayload } from "@/lib/contracts";

export interface BadgeAwardSigner {
  signAndSubmitTransaction: (payload: {
    data: Record<string, unknown>;
  }) => Promise<{ hash: string }>;
}

export async function awardMilestonesForLevel(
  address: string,
  level: number,
  signer: BadgeAwardSigner | null,
): Promise<BadgeDef[]> {
  const defs = milestonesForLevel(level);
  const awarded: BadgeDef[] = [];

  for (const def of defs) {
    let txHash: string | undefined;
    let source: "local" | "chain" = "local";
    const meta = badgeMetadataPayload(address, def);
    const blobName = def.metadataBlobHint;

    if (signer) {
      try {
        const payload = buildMintBadgePayload({
          milestoneId: def.id,
          level: def.level,
          metadataBlobName: blobName,
        });
        const result = await signer.signAndSubmitTransaction({
          data: payload.data as unknown as Record<string, unknown>,
        });
        txHash = result.hash;
        source = "chain";
      } catch (err) {
        console.warn("[shelby:fallback] nft_badge mint skipped", err, meta);
      }
    } else {
      console.warn("[shelby:fallback] badge recorded locally", def.id, meta);
    }

    const entry = recordBadge(address, def, { blobName, txHash, source });
    if (entry) awarded.push(def);
  }

  return awarded;
}
