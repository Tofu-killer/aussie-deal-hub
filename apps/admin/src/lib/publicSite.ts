const PUBLIC_SITE_URL_ENV_NAMES = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"] as const;

export class AdminPublicSiteConfigurationError extends Error {
  constructor() {
    super(
      `${PUBLIC_SITE_URL_ENV_NAMES.join(" or ")} is required for admin links to public deal pages.`,
    );
    this.name = "AdminPublicSiteConfigurationError";
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAdminPublicSiteBaseUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;

  if (!configuredSiteUrl?.trim()) {
    throw new AdminPublicSiteConfigurationError();
  }

  return normalizeBaseUrl(configuredSiteUrl);
}

export function buildAdminPublicUrl(path: string) {
  return new URL(path, `${getAdminPublicSiteBaseUrl()}/`).toString();
}

export function buildAdminPublicDealUrl(locale: "en" | "zh", slug: string) {
  const localePrefix = locale === "zh" ? "/zh" : "/en";
  return buildAdminPublicUrl(`${localePrefix}/deals/${slug}`);
}
