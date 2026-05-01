import { afterEach, describe, expect, it, vi } from "vitest";

import { listPublicDeals, listPublicDealsWithLocaleFallback } from "./serverApi";

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("serverApi locale fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deduplicates locale fallback lists by stable deal id when locale slugs differ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
          return createJsonResponse({
            items: [
              {
                id: "deal_live_lego_1",
                locale: "en",
                slug: "lego-bonsai-tree-for-a-59-at-big-w",
                title: "LEGO Bonsai Tree for A$59 at Big W",
                summary: "Stacked voucher pricing lands the bonsai set at A$59.",
                category: "Deals",
                merchant: "Big W",
                currentPrice: "59.00",
                affiliateUrl: "https://example.test/lego-bonsai-tree",
                publishedAt: "2026-04-23T01:00:00.000Z",
                locales: [
                  {
                    locale: "en",
                    slug: "lego-bonsai-tree-for-a-59-at-big-w",
                    title: "LEGO Bonsai Tree for A$59 at Big W",
                    summary: "Stacked voucher pricing lands the bonsai set at A$59.",
                  },
                  {
                    locale: "zh",
                    slug: "big-w-乐高盆景树套装-a-59",
                    title: "Big W 乐高盆景树套装 A$59",
                    summary: "叠加优惠后乐高盆景树套装到手 A$59。",
                  },
                ],
              },
            ],
          });
        }

        if (String(input) === "http://127.0.0.1:3001/v1/public/deals/zh") {
          return createJsonResponse({
            items: [
              {
                id: "deal_live_lego_1",
                locale: "zh",
                slug: "big-w-乐高盆景树套装-a-59",
                title: "Big W 乐高盆景树套装 A$59",
                summary: "叠加优惠后乐高盆景树套装到手 A$59。",
                category: "Deals",
                merchant: "Big W",
                currentPrice: "59.00",
                affiliateUrl: "https://example.test/lego-bonsai-tree",
                publishedAt: "2026-04-23T01:00:00.000Z",
                locales: [
                  {
                    locale: "en",
                    slug: "lego-bonsai-tree-for-a-59-at-big-w",
                    title: "LEGO Bonsai Tree for A$59 at Big W",
                    summary: "Stacked voucher pricing lands the bonsai set at A$59.",
                  },
                  {
                    locale: "zh",
                    slug: "big-w-乐高盆景树套装-a-59",
                    title: "Big W 乐高盆景树套装 A$59",
                    summary: "叠加优惠后乐高盆景树套装到手 A$59。",
                  },
                ],
              },
            ],
          });
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const deals = await listPublicDealsWithLocaleFallback("en");

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "deal_live_lego_1",
      locale: "en",
      slug: "lego-bonsai-tree-for-a-59-at-big-w",
      locales: [
        {
          locale: "en",
          slug: "lego-bonsai-tree-for-a-59-at-big-w",
        },
        {
          locale: "zh",
          slug: "big-w-乐高盆景树套装-a-59",
        },
      ],
    });
  });

  it("fails fast when API_BASE_URL is missing for server-side requests", async () => {
    const originalValue = process.env.API_BASE_URL;
    delete process.env.API_BASE_URL;

    try {
      await expect(listPublicDeals("en")).rejects.toThrow(
        "API_BASE_URL is required for server-side web API requests.",
      );
    } finally {
      process.env.API_BASE_URL = originalValue;
    }
  });
});
