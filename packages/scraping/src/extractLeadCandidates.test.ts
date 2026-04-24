import { describe, expect, it } from "vitest";

import { extractLeadCandidates } from "./extractLeadCandidates";

describe("extractLeadCandidates", () => {
  it("extracts deal-looking anchors from html on the same host", () => {
    const candidates = extractLeadCandidates({
      body: `
        <html>
          <body>
            <a href="/deal/switch">Nintendo Switch OLED for A$399 at Amazon AU</a>
            <a href="/login">Login</a>
            <a href="https://external.example/deal">External deal</a>
          </body>
        </html>
      `,
      contentType: "text/html; charset=utf-8",
      sourceName: "Example Source",
      sourceType: "community",
      sourceUrl: "https://source.example/home",
    });

    expect(candidates).toEqual([
      {
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
        url: "https://source.example/deal/switch",
        snippet: "Nintendo Switch OLED for A$399 at Amazon AU",
        sourceName: "Example Source",
        sourceType: "community",
      },
    ]);
  });

  it("extracts structured items from json feeds", () => {
    const candidates = extractLeadCandidates({
      body: JSON.stringify({
        items: [
          {
            title: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
            url: "https://feed.example/airpods",
            snippet: "Warehouse promo.",
          },
        ],
      }),
      contentType: "application/json",
      sourceName: "Feed Source",
      sourceType: "publisher",
      sourceUrl: "https://feed.example/deals.json",
    });

    expect(candidates).toEqual([
      {
        title: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
        url: "https://feed.example/airpods",
        snippet: "Warehouse promo.",
        sourceName: "Feed Source",
        sourceType: "official",
      },
    ]);
  });
});
