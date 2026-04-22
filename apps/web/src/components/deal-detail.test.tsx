// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LocaleHomePage from "../app/[locale]/page";
import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import FavoritesPage from "../app/[locale]/favorites/page";
import { LocaleSwitch, PriceCard } from "../lib/ui";

afterEach(() => {
  cleanup();
});

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
    expect(
      englishHome
        .getByRole("link", { name: "Nintendo Switch OLED for A$399 at Amazon AU" })
        .getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au");
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
    expect(chineseDetail.getByText("A$399")).toBeTruthy();
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
