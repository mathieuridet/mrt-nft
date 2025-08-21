import React, { useEffect, useState } from "react";

type NFT = {
  contract: { address: string };
  tokenId: string;
  title?: string;
  media?: { gateway?: string; raw?: string }[];
  metadata?: { image?: string; name?: string };
};

function resolveIpfs(u?: string) {
  if (!u) return "";
  // handles ipfs://CID/... and ipfs://ipfs/CID/...
  return u.startsWith("ipfs://")
    ? `https://nftstorage.link/ipfs/${u.replace("ipfs://", "").replace(/^ipfs\//, "")}`
    : u;
}

function pickImage(nft: NFTv3): string {
  return (
    // Alchemy v3 preferred
    nft.image?.cachedUrl ||
    nft.image?.pngUrl ||
    nft.image?.originalUrl ||
    nft.image?.thumbnailUrl ||
    // Legacy / normalized media
    nft.media?.[0]?.gateway ||
    // Metadata image fields
    resolveIpfs(nft.metadata?.image || nft.metadata?.image_url) ||
    // Token URI fallbacks
    resolveIpfs(nft.tokenUri?.gateway || nft.tokenUri?.raw) ||
    ""
  );
}

export default function NFTGrid({ owner, network = "eth-sepolia" }: { owner: string; network?: string }) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!;
        const url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${owner}&withMetadata=true&contractAddresses[]=${process.env.NEXT_PUBLIC_NFT_ADDRESS}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNfts(data.ownedNfts || data.nfts || []);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [owner, network]);

  if (err) return <div style={{color:"crimson"}}>Error: {err}</div>;

  return (
    <div className="p-4">
      {loading && <div>Loading NFTs…</div>}
      {!loading && nfts.length === 0 && <div>No NFTs found.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12 }}>
        {nfts.map((nft, i) => {
          const img = pickImage(nft);
          const name =
            nft.metadata?.name ||
            nft.title ||
            `${nft.contract.address.slice(0, 6)}… #${nft.tokenId}`;

          return (
            <figure key={`${nft.contract.address}-${nft.tokenId}-${i}`}
                    style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,.08)", background: "#fff" }}>
              {img ? (
                // Use <img> while testing; <Image> requires domain allowlisting.
                <img src={img} alt={name} style={{ width: "100%", height: 220, objectFit: "cover" }} loading="lazy" />
              ) : (
                <div style={{ height: 220, display: "grid", placeItems: "center", background: "#f3f4f6" }}>No image</div>
              )}
              <figcaption style={{ padding: "8px 10px", fontSize: 14, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {name}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
