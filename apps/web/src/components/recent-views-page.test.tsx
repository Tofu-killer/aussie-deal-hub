// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import RecentViewsPage from "../app/[locale]/recent-views/page";
import {
  RECENT_VIEWS_COOKIE_NAME,
  buildRecentViewsCookieValue,
  getRecentViewSlugsFromCookie,
  mergeRecentViewSlug,
} from "../lib/recentViews";

function collectElementsByType(node: React.ReactNode, type: string) {
  const elements: Array<React.ReactElement<{ children?: React.ReactNode; action?: unknown }>> = [];

  function visit(value: React.ReactNode) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!React.isValidElement(value)) {
      return;
    }

    if (value.type === type) {
      elements.push(value as React.ReactElement<{ children?: React.ReactNode; action?: unknown }>);
    }

    visit(value.props.children);
  }

  visit(node);
  return elements;
}

function getPublicDealsListResponse(
  input: string | URL | Request,
  itemsByLocale: Partial<
    Record<
      "en" | "zh",
      Array<{
        affiliateUrl: string;
        category: string;
        currentPrice: string;
        locale: string;
        merchant: string;
        publishedAt: string;
        slug: string;
        summary: string;
        title: string;
      }>
    >
  >,
) {
  if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
    return new Response(
      JSON.stringify({
        items: itemsByLocale.en ?? [],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }

  if (String(input) === "http://127.0.0.1:3001/v1/public/deals/zh") {
    return new Response(
      JSON.stringify({
        items: itemsByLocale.zh ?? [],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }

  return null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.cookie = `${RECENT_VIEWS_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

describe("recent views tracking and page", () => {
  it("deduplicates and keeps newest-first order when merging slugs", () => {
    expect(mergeRecentViewSlug(["airpods-pro-2-costco-au", "nintendo-switch-oled-amazon-au"], "airpods-pro-2-costco-au")).toEqual([
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ]);
    expect(mergeRecentViewSlug(["airpods-pro-2-costco-au", "nintendo-switch-oled-amazon-au"], "epic-game-freebie-week")).toEqual([
      "epic-game-freebie-week",
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ]);
  });

  it("reads cookie on recent views page and renders recent deals in order", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME) {
          return undefined;
        }

        return {
          name,
          value: buildRecentViewsCookieValue([
            "airpods-pro-2-costco-au",
            "nintendo-switch-oled-amazon-au",
          ]),
        };
      },
    } as Awaited<ReturnType<typeof cookies>>);

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    const recentSection = screen.getByRole("region", { name: "Recent deals" });
    const headings = within(recentSection).getAllByRole("heading", { level: 3 });
    expect(headings[0]?.textContent).toBe("AirPods Pro (2nd Gen) for A$299 at Costco AU");
    expect(headings[1]?.textContent).toBe("Nintendo Switch OLED for A$399 at Amazon AU");
  });

  it("parses recent_views from multi-cookie header value", () => {
    const cookieHeader = `foo=bar; ${RECENT_VIEWS_COOKIE_NAME}=${buildRecentViewsCookieValue([
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ])}; theme=light`;

    expect(getRecentViewSlugsFromCookie(cookieHeader)).toEqual([
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ]);
  });

  it("deduplicates dirty cookie values on recent views page", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME) {
          return undefined;
        }

        return {
          name,
          value: buildRecentViewsCookieValue([
            "nintendo-switch-oled-amazon-au",
            "airpods-pro-2-costco-au",
            "nintendo-switch-oled-amazon-au",
          ]),
        };
      },
    } as Awaited<ReturnType<typeof cookies>>);

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(
      screen.getAllByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toHaveLength(1);
  });

  it("keeps recent views deal links and back-home link clean", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME) {
          return undefined;
        }

        return {
          name,
          value: buildRecentViewsCookieValue(["airpods-pro-2-costco-au"]),
        };
      },
    } as Awaited<ReturnType<typeof cookies>>);

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(
      screen
        .getByRole("link", { name: "AirPods Pro (2nd Gen) for A$299 at Costco AU" })
        .getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/airpods-pro-2-costco-au",
    );
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("renders live-only recent views from the batched public deals list", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME) {
          return undefined;
        }

        return {
          name,
          value: buildRecentViewsCookieValue(["live-only-weekend-bundle"]),
        };
      },
    } as Awaited<ReturnType<typeof cookies>>);

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const publicDealsListResponse = getPublicDealsListResponse(input, {
        en: [
          {
            slug: "live-only-weekend-bundle",
            title: "Weekend bundle for A$179 at JB Hi-Fi",
            summary: "Live catalog weekend bundle with pickup available.",
            category: "deals",
            locale: "en",
            merchant: "JB Hi-Fi",
            currentPrice: "179",
            affiliateUrl: "https://example.test/live-only-weekend-bundle",
            publishedAt: "2026-04-23T10:00:00.000Z",
          },
        ],
        zh: [],
      });

      if (publicDealsListResponse) {
        return publicDealsListResponse;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "Weekend bundle for A$179 at JB Hi-Fi",
      }).getAttribute("href"),
    ).toBe("https://example.test/live-only-weekend-bundle");
    expect(screen.getByText("Live catalog weekend bundle with pickup available.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/public/deals/en",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("renders localized fallback copy for english-only live recent views on the Chinese page", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME) {
          return undefined;
        }

        return {
          name,
          value: buildRecentViewsCookieValue(["live-only-weekend-bundle"]),
        };
      },
    } as Awaited<ReturnType<typeof cookies>>);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const publicDealsListResponse = getPublicDealsListResponse(input, {
          en: [
            {
              slug: "live-only-weekend-bundle",
              title: "Weekend bundle for A$179 at JB Hi-Fi",
              summary: "Live catalog weekend bundle with pickup available.",
              category: "deals",
              locale: "en",
              merchant: "JB Hi-Fi",
              currentPrice: "179",
              affiliateUrl: "https://example.test/live-only-weekend-bundle",
              publishedAt: "2026-04-23T10:00:00.000Z",
            },
          ],
          zh: [],
        });

        if (publicDealsListResponse) {
          return publicDealsListResponse;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "zh" }),
      }),
    );

    const recentSection = screen.getByRole("region", { name: "最近浏览的优惠" });
    expect(
      within(recentSection)
        .getByRole("link", {
          name: "JB Hi-Fi 当前优惠：Weekend bundle for A$179 at JB Hi-Fi",
        })
        .getAttribute("href"),
    ).toBe("https://example.test/live-only-weekend-bundle");
    expect(
      within(recentSection).getByText(
        "当前标价 A$179.00，商家是 JB Hi-Fi。商家原文：Live catalog weekend bundle with pickup available.",
      ),
    ).toBeTruthy();
    expect(
      within(recentSection).getByRole("link", { name: "站内详情" }).getAttribute("href"),
    ).toBe("/zh/deals/live-only-weekend-bundle");
  });

  it("renders chinese empty state when cookie is missing", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get() {
        return undefined;
      },
    } as Awaited<ReturnType<typeof cookies>>);

    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "zh" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "最近浏览" })).toBeTruthy();
    expect(screen.getByText("你最近浏览的优惠会显示在这里。")).toBeTruthy();
  });

  it("writes updated recent views cookie from deal detail tracker", async () => {
    document.cookie = `${RECENT_VIEWS_COOKIE_NAME}=${buildRecentViewsCookieValue([
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ])}; path=/`;

    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    await waitFor(() => {
      const cookieValue = getRecentViewSlugsFromCookie(document.cookie);
      expect(cookieValue).toEqual(["nintendo-switch-oled-amazon-au", "airpods-pro-2-costco-au"]);
    });
  });

  it("renders a clear action and shows the empty state after clearing recent views", async () => {
    let cookieValue = buildRecentViewsCookieValue([
      "airpods-pro-2-costco-au",
      "nintendo-switch-oled-amazon-au",
    ]);
    const setCookie = vi.fn((name: string, value: string) => {
      if (name === RECENT_VIEWS_COOKIE_NAME) {
        cookieValue = value;
      }
    });

    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name !== RECENT_VIEWS_COOKIE_NAME || cookieValue.length === 0) {
          return undefined;
        }

        return {
          name,
          value: cookieValue,
        };
      },
      set: setCookie,
    } as Awaited<ReturnType<typeof cookies>>);

    const page = await RecentViewsPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
    });

    render(page);

    expect(screen.getByRole("button", { name: "Clear recent views" })).toBeTruthy();

    const [clearForm] = collectElementsByType(page, "form");
    expect(clearForm).toBeTruthy();

    await expect(
      (clearForm?.props.action as (formData: FormData) => Promise<void>)(new FormData()),
    ).rejects.toThrow("REDIRECT:/en/recent-views");

    expect(setCookie).toHaveBeenCalledWith(
      RECENT_VIEWS_COOKIE_NAME,
      "",
      expect.objectContaining({
        expires: expect.any(Date),
        path: "/",
      }),
    );

    cleanup();
    render(
      await RecentViewsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByText("Your recently viewed deals will appear here.")).toBeTruthy();
  });
});
