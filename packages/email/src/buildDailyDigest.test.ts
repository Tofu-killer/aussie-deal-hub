import { describe, expect, it } from "vitest";

import { buildDailyDigest } from "./buildDailyDigest";

describe("buildDailyDigest", () => {
  it("builds an English digest with a localized subject and deal list", () => {
    const digest = buildDailyDigest("en", [
      {
        title: "Nintendo Switch OLED for A$399",
        merchant: "Amazon AU",
      },
      {
        title: "Kindle Paperwhite for A$179",
        merchant: "Amazon AU",
      },
      {
        title: "Dyson V8 for A$499",
        merchant: "The Good Guys",
      },
    ]);

    expect(digest.subject).toBe("Daily Deals Digest");
    expect(digest.html).toContain("<h2>Amazon AU</h2>");
    expect(digest.html).toContain("<h2>The Good Guys</h2>");
    expect(digest.html).toContain("Nintendo Switch OLED for A$399");
    expect(digest.html).toContain("Kindle Paperwhite for A$179");
    expect(digest.html).toContain("Dyson V8 for A$499");
  });

  it("builds a Chinese digest with a localized subject and deal list", () => {
    const digest = buildDailyDigest("zh", [
      {
        title: "任天堂 Switch OLED 到手 A$399",
        merchant: "亚马逊澳洲",
      },
    ]);

    expect(digest.subject).toBe("每日捡漏摘要");
    expect(digest.html).toContain("任天堂 Switch OLED 到手 A$399");
    expect(digest.html).toContain("亚马逊澳洲");
  });

  it("builds a weekly digest with weekly-specific copy", () => {
    const digest = buildDailyDigest(
      "en",
      [
        {
          title: "Nintendo Switch OLED for A$399",
          merchant: "Amazon AU",
        },
      ],
      {
        frequency: "weekly",
      },
    );

    expect(digest.subject).toBe("Weekly Deals Digest");
    expect(digest.html).toContain("This Week&apos;s Picks");
    expect(digest.html).toContain("Nintendo Switch OLED for A$399");
  });

  it("renders an empty grouped digest without list items when there are no deals", () => {
    const digest = buildDailyDigest("en", []);

    expect(digest.subject).toBe("Daily Deals Digest");
    expect(digest.html).toContain("<section>");
    expect(digest.html).not.toContain("<li>");
  });

  it("escapes merchant and title HTML-sensitive characters", () => {
    const digest = buildDailyDigest("en", [
      {
        title: "<script>alert('x')</script> & Console",
        merchant: "Amazon <AU>",
      },
    ]);

    expect(digest.html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; Console");
    expect(digest.html).toContain("Amazon &lt;AU&gt;");
    expect(digest.html).not.toContain("<script>");
  });
});
