import { describe, expect, it } from "vitest";

import { buildDigestJob } from "./buildDigest";

describe("buildDigestJob", () => {
  it("creates localized digest payloads from published deals only", () => {
    const digests = buildDigestJob([
      {
        id: "deal_1",
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
    ]);

    expect(digests.en).toMatchObject({
      locale: "en",
      subject: "Daily Deals Digest",
      deals: [
        {
          id: "deal_1",
          merchant: "Amazon AU",
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
        },
      ],
    });
    expect(digests.en.html).toContain("Nintendo Switch OLED for A$399 at Amazon AU");
    expect(digests.en.html).not.toContain("Dyson V8 for A$499 at Bing Lee");

    expect(digests.zh).toMatchObject({
      locale: "zh",
      subject: "每日捡漏摘要",
      deals: [
        {
          id: "deal_1",
          merchant: "亚马逊澳洲",
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
        },
      ],
    });
    expect(digests.zh.html).toContain("亚马逊澳洲");
    expect(digests.zh.html).not.toContain("Bing Lee");
  });
});
