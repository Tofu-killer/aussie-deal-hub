// @vitest-environment jsdom

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleSwitch } from "./LocaleSwitch";

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

describe("LocaleSwitch", () => {
  it("renders locale navigation links and marks the active locale", () => {
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

    const navigation = screen.getByRole("navigation", { name: "Locale switch" });
    const englishLink = within(navigation).getByRole("link", { name: "English" });
    const chineseLink = within(navigation).getByRole("link", { name: "中文" });

    expect(englishLink.getAttribute("href")).toBe("/en/deals/nintendo-switch-oled-amazon-au");
    expect(englishLink.getAttribute("aria-current")).toBeNull();
    expect(chineseLink.getAttribute("href")).toBe("/zh/deals/nintendo-switch-oled-amazon-au");
    expect(chineseLink.getAttribute("aria-current")).toBe("page");
  });
});
