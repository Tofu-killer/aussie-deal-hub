export interface RawLeadInput {
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
  sourceType: "official" | "community";
}

export interface NormalizedLead {
  merchant: string;
  canonicalUrl: string;
  localizedHints: string[];
}

function extractMerchant(title: string, fallback: string) {
  const [merchantCandidate] = title.split(":");
  const merchant = merchantCandidate?.trim();

  return merchant && merchant.length > 0 ? merchant : fallback;
}

function toCanonicalUrl(rawUrl: string) {
  const canonicalUrl = new URL(rawUrl);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";

  return canonicalUrl.toString();
}

export function normalizeLead(input: RawLeadInput): NormalizedLead {
  return {
    merchant: extractMerchant(input.title, input.sourceName),
    canonicalUrl: toCanonicalUrl(input.url),
    localizedHints: ["en", "zh"],
  };
}
