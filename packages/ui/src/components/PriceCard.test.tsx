// @vitest-environment jsdom

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceCard } from "./PriceCard";

const require = createRequire(import.meta.url);
const testDependenciesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/web",
);
const { cleanup, render, screen, within } = require(
  require.resolve("@testing-library/react", { paths: [testDependenciesRoot] }),
);

afterEach(() => {
  cleanup();
});

describe("PriceCard", () => {
  it("renders the pricing summary as a named region with optional pricing copy", () => {
    render(
      <PriceCard
        currentPrice="A$399"
        currentPriceLabel="Current price"
        originalPrice="A$469"
        originalPriceLabel="Original price"
        discountLabel="15% off"
        ctaLabel="Go to deal"
        ctaHref="https://example.com/deals/switch"
      />,
    );

    const region = screen.getByRole("region", { name: "Current price" });

    expect(within(region).getByText("A$399")).toBeTruthy();
    expect(within(region).getByText("Original price")).toBeTruthy();
    expect(within(region).getByText("A$469")).toBeTruthy();
    expect(within(region).getByText("15% off")).toBeTruthy();
    expect(within(region).getByRole("link", { name: "Go to deal" }).getAttribute("href")).toBe(
      "https://example.com/deals/switch",
    );
  });

  it("renders unique label ids for repeated cards so each region references its own label", () => {
    render(
      <>
        <PriceCard currentPrice="A$179" currentPriceLabel="Current price" ctaLabel="Check price" />
        <PriceCard currentPrice="A$179" currentPriceLabel="Current price" ctaLabel="Check price" />
      </>,
    );

    const regions = screen.getAllByRole("region", { name: "Current price" });
    const labelIds = regions.map((region) => region.getAttribute("aria-labelledby"));

    expect(labelIds).not.toContain(null);
    expect(new Set(labelIds).size).toBe(labelIds.length);

    for (const region of regions) {
      const labelId = region.getAttribute("aria-labelledby");
      const label = labelId ? document.getElementById(labelId) : null;

      expect(label?.textContent).toBe("Current price");
      expect(label ? region.contains(label) : false).toBe(true);
    }
  });
});
