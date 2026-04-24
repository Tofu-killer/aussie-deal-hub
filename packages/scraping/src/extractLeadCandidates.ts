import type { RawLeadInput } from "./normalizeLead";

interface ExtractLeadCandidatesInput {
  body: string;
  contentType: string | null;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function normalizeSourceType(sourceType: string): RawLeadInput["sourceType"] {
  return sourceType === "community" ? "community" : "official";
}

function buildRawLeadInput(
  sourceName: string,
  sourceType: string,
  title: string,
  url: string,
  snippet: string,
): RawLeadInput | null {
  const normalizedTitle = title.trim();
  const normalizedSnippet = snippet.trim();

  if (
    normalizedTitle.length < 18 ||
    normalizedTitle.length > 180 ||
    !/(\$|a\$|free|deal|discount|sale|off|\d)/i.test(normalizedTitle)
  ) {
    return null;
  }

  return {
    title: normalizedTitle,
    url,
    snippet: normalizedSnippet || normalizedTitle,
    sourceName,
    sourceType: normalizeSourceType(sourceType),
  };
}

function parseJsonCandidates(input: ExtractLeadCandidatesInput): RawLeadInput[] {
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(input.body);
  } catch {
    return [];
  }

  const items = Array.isArray(parsedBody)
    ? parsedBody
    : typeof parsedBody === "object" && parsedBody
      ? ["items", "entries", "posts", "deals"]
          .flatMap((key) =>
            Array.isArray((parsedBody as Record<string, unknown>)[key])
              ? ((parsedBody as Record<string, unknown>)[key] as unknown[])
              : [],
          )
      : [];

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : "";
    const url =
      typeof record.url === "string"
        ? record.url
        : typeof record.link === "string"
          ? record.link
          : typeof record.affiliateUrl === "string"
            ? record.affiliateUrl
            : typeof record.originalUrl === "string"
              ? record.originalUrl
          : "";
    const snippet =
      typeof record.snippet === "string"
        ? record.snippet
        : typeof record.summary === "string"
          ? record.summary
          : "";

    if (!title || !url || !isHttpUrl(url)) {
      return [];
    }

    const candidate = buildRawLeadInput(input.sourceName, input.sourceType, title, url, snippet);
    return candidate ? [candidate] : [];
  });
}

function shouldSkipHref(href: string) {
  return /^(#|javascript:|mailto:|tel:)/i.test(href);
}

function parseHtmlCandidates(input: ExtractLeadCandidatesInput): RawLeadInput[] {
  const sourceUrl = new URL(input.sourceUrl);
  const anchorRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gis;
  const candidates = new Map<string, RawLeadInput>();

  for (const match of input.body.matchAll(anchorRegex)) {
    const href = match[2]?.trim() ?? "";
    const anchorHtml = match[3] ?? "";

    if (!href || shouldSkipHref(href)) {
      continue;
    }

    let resolvedUrl: string;

    try {
      resolvedUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    const resolved = new URL(resolvedUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      continue;
    }

    if (resolved.hostname !== sourceUrl.hostname) {
      continue;
    }

    if (/(login|register|account|profile|privacy|terms)/i.test(resolved.pathname)) {
      continue;
    }

    const title = stripHtmlTags(anchorHtml);
    const candidate = buildRawLeadInput(input.sourceName, input.sourceType, title, resolvedUrl, title);

    if (candidate && !candidates.has(candidate.url)) {
      candidates.set(candidate.url, candidate);
    }
  }

  return [...candidates.values()];
}

export function extractLeadCandidates(input: ExtractLeadCandidatesInput): RawLeadInput[] {
  const contentType = input.contentType?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return parseJsonCandidates(input).slice(0, 10);
  }

  return parseHtmlCandidates(input).slice(0, 10);
}
