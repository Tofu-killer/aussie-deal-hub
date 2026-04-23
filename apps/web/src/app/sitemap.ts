import type { MetadataRoute } from "next";

import { listPublicDeals } from "../lib/serverApi";
import {
  buildPublicSitemapEntries,
  normalizeLivePublicDeal,
  type SupportedLocale,
} from "../lib/publicDeals";

const SITEMAP_LOCALES: SupportedLocale[] = ["en", "zh"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const liveDeals = (
    await Promise.all(
      SITEMAP_LOCALES.map(async (locale) =>
        (await listPublicDeals(locale)).map((deal) => normalizeLivePublicDeal(deal, locale)),
      ),
    )
  ).flat();

  return buildPublicSitemapEntries(liveDeals);
}
