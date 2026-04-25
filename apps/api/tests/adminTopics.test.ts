import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("admin topic routes", () => {
  it("lists deterministic topic rows for admin pages", async () => {
    const app = buildApp();

    const firstResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });
    const secondResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body).toEqual(secondResponse.body);
    expect(firstResponse.body).toEqual({
      items: [
        {
          id: "work-from-home",
          name: "Work From Home",
          slug: "work-from-home",
          spotlightDeals: 6,
          status: "Active",
          owner: "Discovery desk",
        },
        {
          id: "gaming-setup",
          name: "Gaming Setup",
          slug: "gaming-setup",
          spotlightDeals: 9,
          status: "Active",
          owner: "Discovery desk",
        },
        {
          id: "school-savings",
          name: "School Savings",
          slug: "school-savings",
          spotlightDeals: 4,
          status: "Seasonal",
          owner: "Everyday desk",
        },
      ],
    });
  });

  it("creates a topic row and returns it in subsequent topic requests", async () => {
    const app = buildApp();

    const createResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/topics",
      body: {
        name: "EOFY Tech",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: "eofy-tech",
      name: "EOFY Tech",
      slug: "eofy-tech",
      spotlightDeals: 0,
      status: "Draft",
      owner: "Admin topics",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: expect.arrayContaining([
        {
          id: "eofy-tech",
          name: "EOFY Tech",
          slug: "eofy-tech",
          spotlightDeals: 0,
          status: "Draft",
          owner: "Admin topics",
        },
      ]),
    });
  });
});
