// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import CategoryPage from "../app/[locale]/categories/[category]/page";
import SearchPage from "../app/[locale]/search/page";

afterEach(() => {
  cleanup();
});

describe("listing query-param filters", () => {
  it("renders visible filter controls on the search page and preserves current params", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          q: "airpods",
          merchant: "costco-au",
          "discount-band": "20-plus",
          "free-shipping": "true",
          "ending-soon": "true",
          "historical-low": "true",
          sessionToken: "session_filter_123",
        }),
      }),
    );

    const queryInput = screen.getByRole("textbox", { name: "Search deals" }) as HTMLInputElement;
    const merchantSelect = screen.getByRole("combobox", {
      name: "Merchant",
    }) as HTMLSelectElement;
    const discountBandSelect = screen.getByRole("combobox", {
      name: "Discount band",
    }) as HTMLSelectElement;
    const freeShippingCheckbox = screen.getByRole("checkbox", {
      name: "Free shipping only",
    }) as HTMLInputElement;
    const endingSoonCheckbox = screen.getByRole("checkbox", {
      name: "Ending soon",
    }) as HTMLInputElement;
    const historicalLowCheckbox = screen.getByRole("checkbox", {
      name: "Historical lows only",
    }) as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: "Apply filters" });
    const form = submitButton.closest("form");

    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/en/search");
    expect(queryInput.value).toBe("airpods");
    expect(merchantSelect.value).toBe("costco-au");
    expect(discountBandSelect.value).toBe("20-plus");
    expect(freeShippingCheckbox.checked).toBe(true);
    expect(endingSoonCheckbox.checked).toBe(true);
    expect(historicalLowCheckbox.checked).toBe(true);
    expect(form?.querySelector('input[name="sessionToken"]')?.getAttribute("value")).toBe(
      "session_filter_123",
    );
  });

  it("filters search results by merchant and keeps session token on result links", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          q: "au",
          merchant: "costco-au",
          sessionToken: "session_filter_123",
        }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }).getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/airpods-pro-2-costco-au?sessionToken=session_filter_123",
    );
    expect(
      screen.queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
  });

  it("renders merchant browse results without requiring a keyword", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          merchant: "costco-au",
        }),
      }),
    );

    expect(screen.getByText("Showing 1 published deal from Costco AU.")).toBeTruthy();
    expect(screen.getByText("Merchant: Costco AU")).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Enter a keyword to start searching.")).toBeNull();
  });

  it("deduplicates merchant landing copy when the keyword already matches the merchant", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({
          q: "Amazon AU",
          merchant: "amazon-au",
        }),
      }),
    );

    expect(screen.getByText("展示 Amazon AU 的 1 条已发布优惠。")).toBeTruthy();
    expect(screen.getByText("商家：Amazon AU")).toBeTruthy();
    expect(screen.queryByText(/匹配/)).toBeNull();
  });

  it("does not widen to all deals when the merchant filter is unknown", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          merchant: "unknown-merchant",
        }),
      }),
    );

    expect(
      screen.queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeNull();
  });

  it("keeps unknown merchant filters visible on the search page", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          merchant: "unknown-merchant",
        }),
      }),
    );

    const merchantSelect = screen.getByRole("combobox", {
      name: "Merchant",
    }) as HTMLSelectElement;

    expect(merchantSelect.value).toBe("unknown-merchant");
    expect(screen.getByText("Merchant: Unknown merchant (unknown-merchant)")).toBeTruthy();
    expect(
      screen.getByText(
        "No published deals found for Unknown merchant (unknown-merchant) with the current filters.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("No deals match the current filters.")).toBeNull();
  });

  it("filters search results to historical lows only when requested", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          q: "A$",
          "historical-low": "true",
        }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: "Epic weekly freebie now A$0",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {
        name: "A$100 gift card value for A$90 at Coles",
      }),
    ).toBeNull();
  });

  it("filters search results to deals that are both free shipping and ending soon", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          q: "A$",
          "free-shipping": "true",
          "ending-soon": "true",
        }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {
        name: "Epic weekly freebie now A$0",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {
        name: "A$100 gift card value for A$90 at Coles",
      }),
    ).toBeNull();
  });

  it("filters category listings by discount band and preserves filter params on locale switch", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "historical-lows" }),
        searchParams: Promise.resolve({
          "discount-band": "20-plus",
          "free-shipping": "true",
          "ending-soon": "true",
          sessionToken: "session_filter_456",
        }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }).getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/airpods-pro-2-costco-au?sessionToken=session_filter_456",
    );
    expect(
      screen.queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe(
      "/en/categories/historical-lows?sessionToken=session_filter_456&discount-band=20-plus&free-shipping=true&ending-soon=true",
    );
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe(
      "/zh/categories/historical-lows?sessionToken=session_filter_456&discount-band=20-plus&free-shipping=true&ending-soon=true",
    );
  });

  it("renders visible filter controls on the category page and preserves current params", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "deals" }),
        searchParams: Promise.resolve({
          merchant: "amazon-au",
          "discount-band": "under-20",
          "free-shipping": "true",
          "ending-soon": "true",
          "historical-low": "true",
          sessionToken: "session_filter_789",
        }),
      }),
    );

    const merchantSelect = screen.getByRole("combobox", {
      name: "Merchant",
    }) as HTMLSelectElement;
    const discountBandSelect = screen.getByRole("combobox", {
      name: "Discount band",
    }) as HTMLSelectElement;
    const freeShippingCheckbox = screen.getByRole("checkbox", {
      name: "Free shipping only",
    }) as HTMLInputElement;
    const endingSoonCheckbox = screen.getByRole("checkbox", {
      name: "Ending soon",
    }) as HTMLInputElement;
    const historicalLowCheckbox = screen.getByRole("checkbox", {
      name: "Historical lows only",
    }) as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: "Apply filters" });
    const form = submitButton.closest("form");

    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/en/categories/deals");
    expect(merchantSelect.value).toBe("amazon-au");
    expect(discountBandSelect.value).toBe("under-20");
    expect(freeShippingCheckbox.checked).toBe(true);
    expect(endingSoonCheckbox.checked).toBe(true);
    expect(historicalLowCheckbox.checked).toBe(true);
    expect(form?.querySelector('input[name="sessionToken"]')?.getAttribute("value")).toBe(
      "session_filter_789",
    );
  });

  it("renders merchant-filtered category results as a landing state", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "zh", category: "deals" }),
        searchParams: Promise.resolve({
          merchant: "amazon-au",
        }),
      }),
    );

    expect(screen.getByText("展示 Amazon AU 在优惠中的 1 条已发布优惠。")).toBeTruthy();
    expect(screen.getByText("商家：Amazon AU")).toBeTruthy();
    expect(screen.getByText("1 条已发布优惠")).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("该分类暂无优惠。")).toBeNull();
  });

  it("distinguishes filtered category empty states from categories with no deals yet", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "historical-lows" }),
        searchParams: Promise.resolve({
          merchant: "unknown-merchant",
        }),
      }),
    );

    const merchantSelect = screen.getByRole("combobox", {
      name: "Merchant",
    }) as HTMLSelectElement;

    expect(merchantSelect.value).toBe("unknown-merchant");
    expect(screen.getByText("Merchant: Unknown merchant (unknown-merchant)")).toBeTruthy();
    expect(
      screen.getByText(
        "No published deals from Unknown merchant (unknown-merchant) in Historical lows match the current filters.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("No deals in this category yet.")).toBeNull();
  });
});
