import type { MetadataRoute } from "next";

import { buildPublicRobots } from "../lib/publicDeals";

export default function robots(): MetadataRoute.Robots {
  return buildPublicRobots();
}
