// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocaleHomePage from "../app/[locale]/page";
import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import FavoritesPage from "../app/[locale]/favorites/page";
import {
  RECENT_VIEWS_COOKIE_NAME,
  getRecentViewSlugsFromCookie,
} from "../lib/recentViews";
import { LocaleSwitch, PriceCard } from "../lib/ui";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = `${RECENT_VIEWS_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

function stubPriceContextResponse(snapshots: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          priceContext: {
            snapshots,
          },
        }),
    })) as typeof fetch,
  );
}

type FormAction = (formData: FormData) => Promise<void>;

function nodeContainsText(node: React.ReactNode, text: string): boolean {
  if (typeof node === "string") {
    return node === text;
  }

  if (Array.isArray(node)) {
    return node.some((child) => nodeContainsText(child, text));
  }

  if (!React.isValidElement(node)) {
    return false;
  }

  return nodeContainsText(
    (node.props as { children?: React.ReactNode }).children,
    text,
  );
}

function findFormActionByButtonText(node: React.ReactNode, text: string): FormAction {
  if (Array.isArray(node)) {
    for (const child of node) {
      try {
        return findFormActionByButtonText(child, text);
      } catch {
        // Keep walking siblings until the matching form is found.
      }
    }
  }

  if (React.isValidElement(node)) {
    const props = node.props as {
      action?: unknown;
      children?: React.ReactNode;
    };

    if (node.type === "form" && nodeContainsText(props.children, text)) {
      if (typeof props.action !== "function") {
        throw new Error(`Form for ${text} does not expose an action.`);
      }

      return props.action as FormAction;
    }

    return findFormActionByButtonText(props.children, text);
  }

  throw new Error(`Unable to find form action for ${text}.`);
}

describe("public deal surfaces", () => {
  it("shows current price, original price, and CTA", () => {
    render(
      <PriceCard
        currentPrice="A$399"
        originalPrice="A$469"
        discountLabel="15% off"
        ctaLabel="Go to Deal"
        ctaHref="https://example.com/deal"
        currentPriceLabel="Current price"
        originalPriceLabel="Original price"
      />,
    );

    expect(screen.getByText("Current price")).toBeTruthy();
    expect(screen.getByText("A$399")).toBeTruthy();
    expect(screen.getByText("Original price")).toBeTruthy();
    expect(screen.getByText("A$469")).toBeTruthy();
    expect(screen.getByText("15% off")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Go to Deal" }).getAttribute("href"),
    ).toBe("https://example.com/deal");
  });

  it("renders locale switch links and marks the current locale", () => {
    render(
      <LocaleSwitch
        currentLocale="zh"
        locales={[
          {
            locale: "en",
            href: "/en/deals/nintendo-switch-oled-amazon-au",
            label: "English",
          },
          {
            locale: "zh",
            href: "/zh/deals/nintendo-switch-oled-amazon-au",
            label: "中文",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au");
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("renders locale home, deal detail, and favorites shells", async () => {
    const englishHome = render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(englishHome.getByRole("heading", { name: "Today's picks" })).toBeTruthy();
    const featuredSection = englishHome.getByRole("region", { name: "Featured deals" });
    expect(
      within(featuredSection)
        .getByRole("link", { name: "Nintendo Switch OLED for A$399 at Amazon AU" })
        .getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(
      englishHome.getByRole("link", { name: "中文" }).getAttribute("href"),
    ).toBe("/zh");
    expect(
      englishHome.getByRole("link", { name: "Open Favorites" }).getAttribute("href"),
    ).toBe("/en/favorites");
    englishHome.unmount();

    const chineseDetail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    expect(
      chineseDetail.getByRole("heading", { name: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399" }),
    ).toBeTruthy();
    expect(chineseDetail.getAllByText("A$399").length).toBeGreaterThanOrEqual(1);
    expect(
      chineseDetail.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au");
    expect(chineseDetail.getByText("当前价格")).toBeTruthy();
    expect(chineseDetail.getByText("原价")).toBeTruthy();
    chineseDetail.unmount();

    const chineseFavorites = render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "zh" }),
      }),
    );

    expect(chineseFavorites.getByRole("heading", { name: "我的收藏" })).toBeTruthy();
    expect(
      chineseFavorites.getByRole("link", { name: "返回首页" }).getAttribute("href"),
    ).toBe("/zh");
  });

  it("renders seeded deal conversion modules on the detail page", async () => {
    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    expect(detail.getByRole("heading", { name: "Merchant" })).toBeTruthy();
    expect(within(detail.getByRole("region", { name: "Merchant" })).getByText("Amazon AU")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "Coupon code" })).toBeTruthy();
    expect(detail.getByText("GAME20")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "Validity" })).toBeTruthy();
    expect(detail.getByText("Valid until 2026-04-30")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "Why this is worth it" })).toBeTruthy();
    expect(
      detail.getByText("It undercuts the usual A$469 shelf price by A$70 before shipping."),
    ).toBeTruthy();

    const highlights = detail.getByRole("region", { name: "Deal highlights" });
    expect(within(highlights).getByText("A$399 is the tracked low shown for this model.")).toBeTruthy();
    expect(within(highlights).getByText("Sold by Amazon AU with local checkout.")).toBeTruthy();

    const howToGetIt = detail.getByRole("region", { name: "How to get it" });
    expect(within(howToGetIt).getByText("Open the Amazon AU deal page.")).toBeTruthy();
    expect(within(howToGetIt).getByText("Apply GAME20 at checkout.")).toBeTruthy();

    const terms = detail.getByRole("region", { name: "Terms and warnings" });
    expect(within(terms).getByText("Coupon availability can change without notice.")).toBeTruthy();
    expect(within(terms).getByText("Check delivery costs before placing the order.")).toBeTruthy();

    expect(detail.getByRole("heading", { name: "Related deals" })).toBeTruthy();
    detail.unmount();
  });

  it("submits the current detail deal slug to the favorites API", async () => {
    const slug = "nintendo-switch-oled-amazon-au";
    const sessionToken = "session_test_123";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://127.0.0.1:3001/v1/public/deals/en/nintendo-switch-oled-amazon-au") {
        return new Response(
          JSON.stringify({
            priceContext: {
              snapshots: [],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (url === "http://127.0.0.1:3001/v1/favorites") {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
          "content-type": "application/json",
          "x-session-token": sessionToken,
        });
        expect(init?.body).toBe(JSON.stringify({ dealId: slug }));

        return new Response(JSON.stringify({ dealId: slug }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await DealDetailPage({
      params: Promise.resolve({
        locale: "en",
        slug,
      }),
      searchParams: Promise.resolve({
        sessionToken,
      }),
    });

    await expect(findFormActionByButtonText(detail, "Add to Favorites")(new FormData())).rejects.toMatchObject({
      digest: expect.stringContaining(
        `/en/deals/${slug}?favoriteStatus=success`,
      ),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/favorites",
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
      }),
    );
  });

  it("renders add-to-favorites success and failure feedback without dropping detail modules", async () => {
    stubPriceContextResponse([]);

    const successDetail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({
          favoriteStatus: "success",
          sessionToken: "session_test_123",
        }),
      }),
    );

    expect(successDetail.getByRole("button", { name: "Add to Favorites" })).toBeTruthy();
    expect(successDetail.getByRole("status").textContent).toBe("Added to favorites.");
    expect(successDetail.getByRole("heading", { name: "Merchant" })).toBeTruthy();
    expect(successDetail.getByRole("heading", { name: "Related deals" })).toBeTruthy();
    successDetail.unmount();

    const failureDetail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({
          favoriteStatus: "error",
          sessionToken: "session_test_123",
        }),
      }),
    );

    expect(failureDetail.getByRole("button", { name: "加入收藏" })).toBeTruthy();
    expect(failureDetail.getByRole("status").textContent).toBe("收藏失败，请稍后再试。");
    expect(failureDetail.getByRole("heading", { name: "商家" })).toBeTruthy();
    expect(failureDetail.getByRole("heading", { name: "相关优惠" })).toBeTruthy();
    failureDetail.unmount();
  });

  it("renders price context snapshots when the server API succeeds", async () => {
    stubPriceContextResponse([
      {
        label: "Tracked low",
        merchant: "Amazon AU",
        observedAt: "2026-04-18T10:30:00.000Z",
        price: "379",
      },
    ]);

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/public/deals/en/nintendo-switch-oled-amazon-au",
      expect.objectContaining({ cache: "no-store" }),
    );
    const priceContext = detail.getByRole("region", { name: "Price context" });
    expect(within(priceContext).getByText("Selected price snapshots")).toBeTruthy();
    expect(within(priceContext).getByText("Tracked low")).toBeTruthy();
    expect(within(priceContext).getByText("Amazon AU")).toBeTruthy();
    expect(within(priceContext).getByText("A$379")).toBeTruthy();
    expect(within(priceContext).getByText("2026-04-18")).toBeTruthy();
    detail.unmount();
  });

  it("renders the price context fallback when the server API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    expect(detail.getByText("Price context unavailable.")).toBeTruthy();
    detail.unmount();
  });

  it("keeps locale switch and related deal links clean when a session token is present", async () => {
    stubPriceContextResponse([]);

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({
          sessionToken: "session-123",
        }),
      }),
    );

    expect(
      detail.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au");
    expect(
      detail.getByRole("link", { name: "中文" }).getAttribute("href"),
    ).toBe("/zh/deals/nintendo-switch-oled-amazon-au");
    expect(
      detail
        .getByRole("link", { name: "AirPods Pro (2nd Gen) for A$299 at Costco AU" })
        .getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
    expect(detail.getAllByRole("link", { name: "Read breakdown" })[0]?.getAttribute("href")).toBe(
      "/en/deals/airpods-pro-2-costco-au",
    );
    detail.unmount();
  });

  it("records the current deal slug in the recent views cookie", async () => {
    stubPriceContextResponse([]);

    const slug = "nintendo-switch-oled-amazon-au";
    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug,
        }),
      }),
    );

    await waitFor(() => {
      expect(getRecentViewSlugsFromCookie(document.cookie)).toContain(slug);
    });
    detail.unmount();
  });

  it("renders localized Chinese conversion modules", async () => {
    stubPriceContextResponse([]);

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    expect(detail.getByRole("heading", { name: "商家" })).toBeTruthy();
    expect(within(detail.getByRole("region", { name: "商家" })).getByText("Amazon AU")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "优惠码" })).toBeTruthy();
    expect(detail.getByText("GAME20")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "有效期" })).toBeTruthy();
    expect(detail.getByText("有效期至 2026-04-30")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "为什么值得买" })).toBeTruthy();
    expect(detail.getByText("相比常见 A$469 标价低 A$70，运费另计。")).toBeTruthy();
    detail.unmount();
  });

  it("renders no-code copy for seeded deals without a coupon code", async () => {
    stubPriceContextResponse([]);

    const englishDetail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "epic-game-freebie-week",
        }),
      }),
    );

    expect(englishDetail.getByRole("heading", { name: "Coupon code" })).toBeTruthy();
    expect(englishDetail.getByText("No code required")).toBeTruthy();
    englishDetail.unmount();

    const chineseDetail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "epic-game-freebie-week",
        }),
      }),
    );

    expect(chineseDetail.getByRole("heading", { name: "优惠码" })).toBeTruthy();
    expect(chineseDetail.getByText("无需优惠码")).toBeTruthy();
    chineseDetail.unmount();
  });

  it("renders a live-only API deal with shopper-facing detail modules", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (
          String(input)
          === "http://127.0.0.1:3001/v1/public/deals/en/breville-barista-express-for-a-499"
        ) {
          return new Response(
            JSON.stringify({
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the public API.",
              category: "Deals",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              priceContext: {
                snapshots: [],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "breville-barista-express-for-a-499",
        }),
      }),
    );

    expect(
      detail.getByRole("heading", { name: "Breville Barista Express for A$499" }),
    ).toBeTruthy();
    expect(detail.getByText("Live catalog deal loaded from the public API.")).toBeTruthy();
    expect(detail.getAllByText("A$499.00").length).toBeGreaterThanOrEqual(2);
    expect(detail.queryByText("Original price")).toBeNull();
    expect(within(detail.getByRole("region", { name: "Merchant" })).getByText("The Good Guys")).toBeTruthy();
    expect(detail.getByText("Published on 2026-04-23")).toBeTruthy();
    expect(
      detail.getByText("The current listed price is A$499.00 at The Good Guys."),
    ).toBeTruthy();

    const highlights = detail.getByRole("region", { name: "Deal highlights" });
    expect(within(highlights).getByText("Current listed price: A$499.00.")).toBeTruthy();
    expect(within(highlights).getByText("Published by The Good Guys on 2026-04-23.")).toBeTruthy();

    const howToGetIt = detail.getByRole("region", { name: "How to get it" });
    expect(within(howToGetIt).getByText("Open the merchant page from the deal link.")).toBeTruthy();
    expect(within(howToGetIt).getByText("Confirm the final checkout price and stock before you buy.")).toBeTruthy();

    const terms = detail.getByRole("region", { name: "Terms and warnings" });
    expect(within(terms).getByText("No tracked price comparison is available for this deal yet.")).toBeTruthy();
    expect(
      within(terms).getByText("Shipping, account limits, and campaign exclusions are set by the merchant."),
    ).toBeTruthy();

    expect(detail.getByRole("heading", { name: "Deal highlights" })).toBeTruthy();
    expect(detail.queryByText("This live deal was published from the admin catalog.")).toBeNull();
    expect(detail.queryByText("Loaded from the live public deals API.")).toBeNull();
    detail.unmount();
  });

  it("renders localized fallback copy when a Chinese live detail page receives English-only content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (
          String(input)
          === "http://127.0.0.1:3001/v1/public/deals/zh/breville-barista-express-for-a-499"
        ) {
          return new Response(
            JSON.stringify({
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the public API.",
              category: "Deals",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              priceContext: {
                snapshots: [],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "breville-barista-express-for-a-499",
        }),
      }),
    );

    expect(
      detail.getByRole("heading", {
        name: "The Good Guys 当前优惠：Breville Barista Express for A$499",
      }),
    ).toBeTruthy();
    expect(
      detail.getByText(
        "当前标价 A$499.00，商家是 The Good Guys。商家原文：Live catalog deal loaded from the public API.",
      ),
    ).toBeTruthy();
    expect(detail.getByText("当前标价是 A$499.00，商家是 The Good Guys。")).toBeTruthy();
    expect(detail.getByRole("heading", { name: "优惠亮点" })).toBeTruthy();
    detail.unmount();
  });

  it("localizes unknown merchant labels on a Chinese live detail page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (
          String(input)
          === "http://127.0.0.1:3001/v1/public/deals/zh/breville-barista-express-for-a-499"
        ) {
          return new Response(
            JSON.stringify({
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the public API.",
              category: "Deals",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              priceContext: {
                snapshots: [],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "breville-barista-express-for-a-499",
        }),
      }),
    );

    expect(detail.getAllByText("未知商家").length).toBeGreaterThanOrEqual(2);
    expect(detail.queryByText("Unknown merchant")).toBeNull();
    detail.unmount();
  });

  it("uses tracked price snapshots to enrich a live-only API deal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (
          String(input)
          === "http://127.0.0.1:3001/v1/public/deals/en/breville-barista-express-tracked-low"
        ) {
          return new Response(
            JSON.stringify({
              locale: "en",
              slug: "breville-barista-express-tracked-low",
              title: "Breville Barista Express for A$499",
              summary: "Fresh live catalog deal with tracked price history.",
              category: "Historical Lows",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              priceContext: {
                snapshots: [
                  {
                    label: "Previous promo",
                    merchant: "The Good Guys",
                    observedAt: "2026-04-10T01:00:00.000Z",
                    price: "559.00",
                  },
                  {
                    label: "Current public deal",
                    merchant: "The Good Guys",
                    observedAt: "2026-04-23T01:00:00.000Z",
                    price: "499.00",
                  },
                ],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "breville-barista-express-tracked-low",
        }),
      }),
    );

    expect(detail.getByText("Original price")).toBeTruthy();
    expect(
      within(detail.getByRole("region", { name: "Current price" })).getByText("A$559.00"),
    ).toBeTruthy();
    expect(
      within(detail.getByRole("region", { name: "Current price" })).getByText(
        "11% below tracked high",
      ),
    ).toBeTruthy();
    expect(
      detail.getByText("Current A$499.00 is A$60.00 below the tracked high of A$559.00."),
    ).toBeTruthy();

    const highlights = detail.getByRole("region", { name: "Deal highlights" });
    expect(within(highlights).getByText("Tracked range: A$499.00 to A$559.00.")).toBeTruthy();
    expect(within(highlights).getByText("Published by The Good Guys on 2026-04-23.")).toBeTruthy();
    detail.unmount();
  });

  it("does not present a lower tracked snapshot as the original price", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (
          String(input)
          === "http://127.0.0.1:3001/v1/public/deals/en/breville-barista-express-price-up"
        ) {
          return new Response(
            JSON.stringify({
              locale: "en",
              slug: "breville-barista-express-price-up",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the public API.",
              category: "deals",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              priceContext: {
                snapshots: [
                  {
                    label: "Earlier tracked price",
                    merchant: "The Good Guys",
                    observedAt: "2026-04-10T01:00:00.000Z",
                    price: "479.00",
                  },
                  {
                    label: "Older tracked price",
                    merchant: "The Good Guys",
                    observedAt: "2026-04-01T01:00:00.000Z",
                    price: "459.00",
                  },
                ],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    const detail = render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "breville-barista-express-price-up",
        }),
      }),
    );

    expect(detail.queryByText("Original price")).toBeNull();
    expect(
      within(detail.getByRole("region", { name: "Current price" })).queryByText(
        "11% below tracked high",
      ),
    ).toBeNull();
    expect(
      detail.getByText("The current listed price is A$499.00 at The Good Guys."),
    ).toBeTruthy();
    expect(detail.queryByText("Current A$499.00 is A$20.00 below the tracked high of A$479.00.")).toBeNull();
    detail.unmount();
  });

  it("throws notFound for unknown deals instead of rendering a soft 404 shell", async () => {
    await expect(
      DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "missing-deal",
        }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });
});
