interface FavoriteRecord {
  dealId: string;
}

interface FavoritesResponse {
  items: FavoriteRecord[];
}

interface PublicPriceSnapshotRecord {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

interface PublicDealPriceContextResponse {
  priceContext?: {
    snapshots?: PublicPriceSnapshotRecord[];
  };
}

const DEFAULT_SERVER_API_BASE_URL = "http://127.0.0.1:3001";

function getServerApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_SERVER_API_BASE_URL;
}

function buildServerApiUrl(path: string) {
  return new URL(path, getServerApiBaseUrl()).toString();
}

async function fetchServerJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(buildServerApiUrl(path), {
    cache: "no-store",
    ...init,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Server API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listFavoriteDealIds(sessionToken: string | undefined) {
  if (!sessionToken) {
    return [];
  }

  const response = await fetchServerJson<FavoritesResponse>("/v1/favorites", {
    headers: {
      "x-session-token": sessionToken,
    },
  });

  return response?.items ?? [];
}

export async function listPriceSnapshots(locale: string, slug: string) {
  const response = await fetchServerJson<PublicDealPriceContextResponse>(
    `/v1/public/deals/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
  );

  return response?.priceContext?.snapshots ?? [];
}
