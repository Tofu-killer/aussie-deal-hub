import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("public deals", () => {
  it("returns a published localized deal by locale and slug", async () => {
    const app = buildApp();
    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en/nintendo-switch-oled-amazon-au"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      locale: "en",
      slug: "nintendo-switch-oled-amazon-au",
      title: "Nintendo Switch OLED for A$399 at Amazon AU",
    });
  });
});
