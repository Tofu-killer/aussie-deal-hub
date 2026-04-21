import { describe, expect, it } from "vitest";

import { reviewLead } from "./reviewLead";

describe("reviewLead", () => {
  it("parses Amazon AU titles that include a colon and coupon copy", () => {
    const review = reviewLead({
      originalTitle: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
      snippet: "Coupon GAME20 expires tonight.",
    });

    expect(review.locales.en.title).toBe("Nintendo Switch OLED for A$399 at Amazon AU");
    expect(review.locales.zh.title).toBe("亚马逊澳洲 Nintendo Switch OLED 到手 A$399");
  });

  it("keeps non-Amazon merchants out of the product title", () => {
    const review = reviewLead({
      originalTitle: "eBay Nintendo Switch OLED A$399",
      snippet: "",
    });

    expect(review.locales.en.title).toBe("Nintendo Switch OLED for A$399 at eBay");
    expect(review.locales.zh.title).toBe("eBay Nintendo Switch OLED 到手 A$399");
  });

  it("classifies historical-low style copy into Historical Lows", () => {
    const review = reviewLead({
      originalTitle: "Amazon AU - Ninja Creami A$199",
      snippet: "Historical low price for this model.",
    });

    expect(review.category).toBe("Historical Lows");
    expect(review.locales.en.title).toBe("Ninja Creami for A$199 at Amazon AU");
  });

  it("does not classify free shipping copy as a freebie", () => {
    const review = reviewLead({
      originalTitle: "Amazon AU - Kindle Paperwhite A$179",
      snippet: "Free shipping for Prime members.",
    });

    expect(review.category).toBe("Deals");
  });

  it("keeps JB Hi-Fi as the merchant instead of folding it into the product title", () => {
    const review = reviewLead({
      originalTitle: "JB Hi-Fi Nintendo Switch OLED A$399",
      snippet: "",
    });

    expect(review.locales.en.title).toBe("Nintendo Switch OLED for A$399 at JB Hi-Fi");
    expect(review.locales.zh.title).toBe("JB Hi-Fi Nintendo Switch OLED 到手 A$399");
  });

  it("falls back to a sensible single-word merchant when the title has no delimiter", () => {
    const review = reviewLead({
      originalTitle: "Target Nintendo Switch OLED A$399",
      snippet: "",
    });

    expect(review.locales.en.title).toBe("Nintendo Switch OLED for A$399 at Target");
    expect(review.locales.zh.title).toBe("Target Nintendo Switch OLED 到手 A$399");
  });

  it("keeps common multi-word Australian merchants intact", () => {
    const harveyNorman = reviewLead({
      originalTitle: "Harvey Norman Nintendo Switch OLED A$399",
      snippet: "",
    });
    const goodGuys = reviewLead({
      originalTitle: "The Good Guys Dyson V8 A$499",
      snippet: "",
    });

    expect(harveyNorman.locales.en.title).toBe("Nintendo Switch OLED for A$399 at Harvey Norman");
    expect(goodGuys.locales.en.title).toBe("Dyson V8 for A$499 at The Good Guys");
  });
});
