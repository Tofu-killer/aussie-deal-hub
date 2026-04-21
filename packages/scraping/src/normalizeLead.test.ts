import { describe, expect, it } from "vitest";
import { normalizeLead } from "./normalizeLead";

describe("normalizeLead", () => {
  it("extracts merchant, canonical URL, and fallback localized hints", () => {
    const normalized = normalizeLead({
      title: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
      url: "https://www.amazon.com.au/deal?ref=tracking&utm_source=test",
      snippet: "Use coupon GAME20 before midnight.",
      sourceName: "OzBargain",
      sourceType: "community",
    });

    expect(normalized.merchant).toBe("Amazon AU");
    expect(normalized.canonicalUrl).toBe("https://www.amazon.com.au/deal");
    expect(normalized.localizedHints).toEqual(["en", "zh"]);
  });
});
