// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CategoryPage from "../app/[locale]/categories/[category]/page";
import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import * as discovery from "../lib/discovery";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("category listing and related deals", () => {
  it("renders category listing with bilingual title and locale switch links", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "deals" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Deals", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Available deals", level: 2 })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/categories/deals?sessionToken=session_test_123");
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe(
      "/zh/categories/deals?sessionToken=session_test_123",
    );
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_123");
  });

  it("renders empty state copy in Chinese when category has no deals", async () => {
    vi.spyOn(discovery, "getCategoryDealGroups").mockReturnValue([
      {
        category: "freebies",
        label: "免费领取",
        deals: [],
      },
    ]);

    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "zh", category: "freebies" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "免费领取优惠" })).toBeTruthy();
    expect(screen.getByText("该分类暂无优惠。")).toBeTruthy();
  });

  it("throws notFound for invalid category", async () => {
    await expect(
      CategoryPage({
        params: Promise.resolve({ locale: "en", category: "featured" }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("renders related deals section on deal detail page", async () => {
    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    const relatedSection = screen.getByRole("region", { name: "Related deals" });
    expect(
      within(relatedSection).getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeTruthy();
    expect(
      within(relatedSection).queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
  });

  it("preserves session token in related deal links on detail page", async () => {
    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({ sessionToken: "session_test_789" }),
      }),
    );

    const relatedSection = screen.getByRole("region", { name: "Related deals" });
    expect(
      within(relatedSection)
        .getByRole("link", {
          name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
        })
        .getAttribute("href"),
    ).toBe("/en/deals/airpods-pro-2-costco-au?sessionToken=session_test_789");
  });
});
