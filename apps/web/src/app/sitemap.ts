import type { MetadataRoute } from "next";

import { listPublicDeals } from "../lib/serverApi";
import {
  buildPublicSitemapEntries,
  normalizeLivePublicDeal,
  type PublicDealRecord,
  type SupportedLocale,
} from "../lib/publicDeals";
import { isServerApiConfigurationError } from "../lib/runtimeApi";

const SITEMAP_LOCALES: SupportedLocale[] = ["en", "zh"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let liveDeals: PublicDealRecord[] = [];

  try {
    liveDeals = (
      await Promise.all(
        SITEMAP_LOCALES.map(async (locale) =>
          (await listPublicDeals(locale)).map((deal) => normalizeLivePublicDeal(deal, locale)),
        ),
      )
    ).flat();
  } catch (error) {
    if (!isServerApiConfigurationError(error)) {
      throw error;
    }
  }

  return buildPublicSitemapEntries(liveDeals);
}
