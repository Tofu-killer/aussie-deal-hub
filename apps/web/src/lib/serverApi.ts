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

export interface PublicApiDealRecord {
  affiliateUrl?: string;
  category: string;
  currentPrice?: string;
  id?: string;
  locale: string;
  locales?: Array<{
    locale: string;
    slug: string;
    title: string;
    summary: string;
  }>;
  merchant?: string;
  priceContext?: {
    snapshots?: PublicPriceSnapshotRecord[];
  };
  publishedAt?: string;
  slug: string;
  summary: string;
  title: string;
}

interface PublicDealsResponse {
  items?: PublicApiDealRecord[];
}

interface PublicDealPriceContextResponse {
  priceContext?: {
    snapshots?: PublicPriceSnapshotRecord[];
  };
}

interface VerifyCodeResponse {
  sessionToken: string;
}

export interface DigestPreferencesRecord {
  categories: string[];
  frequency: string;
  locale: string;
}

const DEFAULT_SERVER_API_BASE_URL = "http://127.0.0.1:3001";
const PUBLIC_DEAL_LOCALES = ["en", "zh"] as const;

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

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();
  if (responseText.trim().length === 0) {
    return null;
  }

  return JSON.parse(responseText) as T;
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

export async function removeFavoriteDealId(sessionToken: string | undefined, dealId: string) {
  if (!sessionToken) {
    return;
  }

  await fetchServerJson(`/v1/favorites/${encodeURIComponent(dealId)}`, {
    method: "DELETE",
    headers: {
      "x-session-token": sessionToken,
    },
  });
}

export async function listPriceSnapshots(locale: string, slug: string) {
  const response = await fetchServerJson<PublicDealPriceContextResponse>(
    `/v1/public/deals/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
  );

  return response?.priceContext?.snapshots ?? [];
}

export async function listPublicDeals(locale: string) {
  try {
    const response = await fetchServerJson<PublicDealsResponse>(
      `/v1/public/deals/${encodeURIComponent(locale)}`,
    );

    return response?.items ?? [];
  } catch {
    return [];
  }
}

export async function getPublicDealFromApi(locale: string, slug: string) {
  try {
    return await fetchServerJson<PublicApiDealRecord>(
      `/v1/public/deals/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
    );
  } catch {
    return null;
  }
}

function getAlternatePublicDealLocale(locale: string) {
  return PUBLIC_DEAL_LOCALES.find((candidateLocale) => candidateLocale !== locale) ?? null;
}

function mergePublicApiDealRecords(
  primaryDeals: PublicApiDealRecord[],
  fallbackDeals: PublicApiDealRecord[],
) {
  const getDealKey = (deal: PublicApiDealRecord) => deal.id ?? `${deal.locale}:${deal.slug}`;
  const primaryKeys = new Set(primaryDeals.map(getDealKey));

  return [
    ...primaryDeals,
    ...fallbackDeals.filter((deal) => !primaryKeys.has(getDealKey(deal))),
  ];
}

export async function listPublicDealsWithLocaleFallback(locale: string) {
  const alternateLocale = getAlternatePublicDealLocale(locale);

  if (!alternateLocale) {
    return listPublicDeals(locale);
  }

  const [primaryDeals, fallbackDeals] = await Promise.all([
    listPublicDeals(locale),
    listPublicDeals(alternateLocale),
  ]);

  return mergePublicApiDealRecords(primaryDeals, fallbackDeals);
}

export async function getPublicDealFromApiWithLocaleFallback(locale: string, slug: string) {
  const primaryDeal = await getPublicDealFromApi(locale, slug);

  if (primaryDeal) {
    return primaryDeal;
  }

  const alternateLocale = getAlternatePublicDealLocale(locale);

  if (!alternateLocale) {
    return null;
  }

  return getPublicDealFromApi(alternateLocale, slug);
}

export async function getDigestPreferences(sessionToken: string | undefined) {
  if (!sessionToken) {
    throw new Error("Session token is required.");
  }

  const response = await fetchServerJson<DigestPreferencesRecord>("/v1/digest-preferences", {
    headers: {
      "x-session-token": sessionToken,
    },
  });

  if (!response) {
    throw new Error("Digest preferences not found.");
  }

  return response;
}

export async function updateDigestPreferences(
  sessionToken: string | undefined,
  preferences: DigestPreferencesRecord,
) {
  if (!sessionToken) {
    throw new Error("Session token is required.");
  }

  const response = await fetchServerJson<DigestPreferencesRecord>("/v1/digest-preferences", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-session-token": sessionToken,
    },
    body: JSON.stringify(preferences),
  });

  return response ?? preferences;
}

export async function requestLoginCode(email: string) {
  await fetchServerJson<{ ok?: boolean }>("/v1/auth/request-code", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

export async function verifyLoginCode(email: string, code: string) {
  const response = await fetchServerJson<VerifyCodeResponse>("/v1/auth/verify-code", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, code }),
  });

  if (!response?.sessionToken) {
    throw new Error("Missing session token.");
  }

  return response.sessionToken;
}
