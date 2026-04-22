import { describe, expect, it } from "vitest";

import { buildDigestJob } from "./buildDigest";

describe("buildDigestJob persistence", () => {
  it("keeps only published favorite deals in each locale payload", () => {
    const digests = buildDigestJob({
      favorites: [
        {
          dealId: "nintendo-switch-oled-amazon-au",
        },
        {
          dealId: "dyson-v8-bing-lee",
        },
      ],
      deals: [
        {
          id: "deal_1",
          slug: "nintendo-switch-oled-amazon-au",
          merchant: "Amazon AU",
          status: "published",
          locales: {
            en: {
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
            },
            zh: {
              title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
              merchant: "亚马逊澳洲",
            },
          },
        },
        {
          id: "deal_2",
          slug: "dyson-v8-bing-lee",
          merchant: "Bing Lee",
          status: "draft",
          locales: {
            en: {
              title: "Dyson V8 for A$499 at Bing Lee",
            },
            zh: {
              title: "Bing Lee Dyson V8 到手 A$499",
            },
          },
        },
      ],
    });

    expect(digests.en.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "Amazon AU",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
      },
    ]);
    expect(digests.zh.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      },
    ]);
    expect(digests.en.subject).toBe("Daily Deals Digest");
    expect(digests.zh.subject).toBe("每日捡漏摘要");
  });

  it("keeps the persisted slug-based identity when building from locale records", () => {
    const digests = buildDigestJob([
      {
        id: "deal_1",
        slug: "nintendo-switch-oled-amazon-au",
        merchant: "Amazon AU",
        status: "published",
        locales: {
          en: {
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            merchant: "亚马逊澳洲",
          },
        },
      },
    ]);

    expect(digests.en.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "Amazon AU",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
      },
    ]);
    expect(digests.zh.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      },
    ]);
  });
});
