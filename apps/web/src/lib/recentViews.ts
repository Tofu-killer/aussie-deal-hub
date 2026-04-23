export const RECENT_VIEWS_COOKIE_NAME = "recent_views";
export const RECENT_VIEWS_LIMIT = 10;

function normalizeSlug(slug: string) {
  return slug.trim();
}

function parseRecentViewsValue(value: string) {
  return value
    .split(",")
    .map((slug) => normalizeSlug(decodeURIComponent(slug)))
    .filter((slug) => slug.length > 0);
}

function deduplicatePreservingOrder(slugs: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const slug of slugs) {
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    result.push(slug);
  }

  return result;
}

function getCookieValueByName(cookieSource: string, name: string) {
  const parts = cookieSource.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }

  return "";
}

export function getRecentViewSlugsFromCookie(cookieSource: string | undefined) {
  if (!cookieSource) {
    return [] as string[];
  }

  const rawValue = cookieSource.includes("=")
    ? getCookieValueByName(cookieSource, RECENT_VIEWS_COOKIE_NAME)
    : cookieSource;

  if (!rawValue) {
    return [] as string[];
  }

  return deduplicatePreservingOrder(parseRecentViewsValue(rawValue));
}

export function mergeRecentViewSlug(existingSlugs: string[], slug: string) {
  const nextSlug = normalizeSlug(slug);
  if (!nextSlug) {
    return existingSlugs;
  }

  return [nextSlug, ...existingSlugs.filter((existing) => normalizeSlug(existing) !== nextSlug)].slice(
    0,
    RECENT_VIEWS_LIMIT,
  );
}

export function buildRecentViewsCookieValue(slugs: string[]) {
  return slugs.map((slug) => encodeURIComponent(normalizeSlug(slug))).join(",");
}
