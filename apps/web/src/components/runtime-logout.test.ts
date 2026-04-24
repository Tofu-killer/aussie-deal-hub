import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../app/[locale]/logout/route";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl) {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  } else {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

describe("logout runtime route", () => {
  it("redirects to the configured public site origin and clears the session cookie", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://deals.example";

    const response = await GET(
      new Request("http://localhost:3000/en/logout"),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://deals.example/en");
    expect(response.headers.get("set-cookie")).toContain("aussie_deal_hub_session=");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });
});
