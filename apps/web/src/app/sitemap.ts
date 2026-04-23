import type { MetadataRoute } from "next";

import { buildPublicSitemapEntries } from "../lib/publicDeals";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildPublicSitemapEntries();
}
