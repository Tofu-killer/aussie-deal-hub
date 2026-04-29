// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

import LocaleHomePage from "../app/[locale]/page";
import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import FavoritesPage from "../app/[locale]/favorites/page";

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

function buildFormDataFromElement(element: React.ReactElement<{ children?: React.ReactNode }>) {
  const formData = new FormData();

  for (const input of collectElementsByType(element, "input")) {
    const name = input.props.name;
    const value = input.props.value;

    if (typeof name === "string" && typeof value === "string") {
      formData.append(name, value);
    }
  }

  return formData;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("favorites and price context pages", () => {
  it("renders real favorite rows from the API on the favorites page", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
        return new Response(
          JSON.stringify({
            items: [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      expect(String(input)).toBe("http://127.0.0.1:3001/v1/favorites");

      return new Response(
        JSON.stringify({
          items: [{ dealId: "nintendo-switch-oled-amazon-au" }],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "My Favorites" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Saved deals" })).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );
    expect(screen.getByText("A$399")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe(
      "/en",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/favorites",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          "x-session-token": "session_test_123",
        },
      }),
    );
  });

  it("renders persisted price context with bilingual labels on the detail page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3001/v1/public/deals/zh/nintendo-switch-oled-amazon-au",
        );

        return new Response(
          JSON.stringify({
            locale: "zh",
            slug: "nintendo-switch-oled-amazon-au",
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
            priceContext: {
              snapshots: [
                {
                  label: "Previous promo",
                  merchant: "Amazon AU",
                  observedAt: "2025-03-14T00:00:00.000Z",
                  price: "429.00",
                },
                {
                  label: "Current public deal",
                  merchant: "Amazon AU",
                  observedAt: "2025-04-15T00:00:00.000Z",
                  price: "399.00",
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
      }),
    );

    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "zh",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "价格参考" })).toBeTruthy();
    expect(screen.getByText("历史价格快照")).toBeTruthy();

    const priceContext = screen.getByRole("region", { name: "价格参考" });
    expect(within(priceContext).getByText("Previous promo")).toBeTruthy();
    expect(within(priceContext).getByText("Current public deal")).toBeTruthy();
    expect(within(priceContext).getAllByText("Amazon AU")).toHaveLength(2);
    expect(within(priceContext).getByText("A$429.00")).toBeTruthy();
    expect(within(priceContext).getByText("A$399.00")).toBeTruthy();
    expect(within(priceContext).getByText("2025-03-14")).toBeTruthy();
    expect(within(priceContext).getByText("2025-04-15")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au");
  });

  it("keeps the home favorites entry point and locale switch clean", async () => {
    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Open Favorites" }).getAttribute("href")).toBe(
      "/en/favorites",
    );
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe("/zh");
  });

  it("shows explicit API error copy instead of pretending empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("upstream error", {
          status: 500,
        });
      }),
    );

    render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByText("无法加载收藏。")).toBeTruthy();
  });

  it("renders remove actions without hiding deals through removedDealId query params", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
          return new Response(
            JSON.stringify({
              items: [],
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            items: [
              { dealId: "nintendo-switch-oled-amazon-au" },
              { dealId: "airpods-pro-2-costco-au" },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }),
    );

    render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          sessionToken: "session_test_123",
          removedDealId: "nintendo-switch-oled-amazon-au",
        } as never),
      }),
    );

    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }).getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
  });

  it("renders live-only favorites from the batched public deals list", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "http://127.0.0.1:3001/v1/favorites") {
        return new Response(
          JSON.stringify({
            items: [{ dealId: "live-only-weekend-bundle" }],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
        return new Response(
          JSON.stringify({
            items: [
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
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "Weekend bundle for A$179 at JB Hi-Fi",
      }).getAttribute("href"),
    ).toBe("https://example.test/live-only-weekend-bundle");
    expect(screen.getByText("Live catalog weekend bundle with pickup available.")).toBeTruthy();
    expect(screen.getByText("A$179")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/public/deals/en",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("renders orphaned favorites as visible removable rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
          return new Response(
            JSON.stringify({
              items: [],
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            items: [
              { dealId: "nintendo-switch-oled-amazon-au" },
              { dealId: "retired-deal-123" },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }),
    );

    const page = await FavoritesPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
    });
    const removeForms = collectElementsByType(page, "form");

    render(page);

    expect(screen.getByText("retired-deal-123")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    expect(removeForms.map((form) => buildFormDataFromElement(form).get("dealId"))).toContain(
      "retired-deal-123",
    );
  });

  it("deletes favorites through the API before redirecting back to a clean favorites URL", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
        return new Response(
          JSON.stringify({
            items: [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (
        String(input) ===
          "http://127.0.0.1:3001/v1/favorites/nintendo-switch-oled-amazon-au" &&
        init?.method === "DELETE"
      ) {
        return new Response(null, {
          status: 204,
        });
      }

      if (String(input) === "http://127.0.0.1:3001/v1/favorites") {
        return new Response(
          JSON.stringify({
            items: [{ dealId: "nintendo-switch-oled-amazon-au" }],
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
    });

    vi.stubGlobal("fetch", fetchMock);

    const page = await FavoritesPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
    });

    const [removeForm] = collectElementsByType(page, "form");

    expect(removeForm).toBeTruthy();
    await expect(
      (removeForm?.props.action as (formData: FormData) => Promise<void>)(
        buildFormDataFromElement(removeForm!),
      ),
    ).rejects.toThrow("REDIRECT:/en/favorites");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/favorites/nintendo-switch-oled-amazon-au",
      expect.objectContaining({
        cache: "no-store",
        method: "DELETE",
        headers: {
          "x-session-token": "session_test_123",
        },
      }),
    );
  });

  it("redirects back with localized page feedback when removing a favorite fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/zh") {
        return new Response(
          JSON.stringify({
            items: [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (
        String(input) ===
          "http://127.0.0.1:3001/v1/favorites/nintendo-switch-oled-amazon-au" &&
        init?.method === "DELETE"
      ) {
        return new Response("upstream error", {
          status: 500,
        });
      }

      if (String(input) === "http://127.0.0.1:3001/v1/favorites") {
        return new Response(
          JSON.stringify({
            items: [{ dealId: "nintendo-switch-oled-amazon-au" }],
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
    });

    vi.stubGlobal("fetch", fetchMock);

    const page = await FavoritesPage({
      params: Promise.resolve({ locale: "zh" }),
      searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
    });

    const [removeForm] = collectElementsByType(page, "form");

    expect(removeForm).toBeTruthy();
    await expect(
      (removeForm?.props.action as (formData: FormData) => Promise<void>)(
        buildFormDataFromElement(removeForm!),
      ),
    ).rejects.toThrow("REDIRECT:/zh/favorites?removeStatus=error");

    render(
      await FavoritesPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({
          sessionToken: "session_test_123",
          removeStatus: "error",
        } as never),
      }),
    );

    expect(screen.getByRole("status").textContent).toBe("移除收藏失败，请稍后再试。");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/favorites/nintendo-switch-oled-amazon-au",
      expect.objectContaining({
        cache: "no-store",
        method: "DELETE",
        headers: {
          "x-session-token": "session_test_123",
        },
      }),
    );
  });
});
