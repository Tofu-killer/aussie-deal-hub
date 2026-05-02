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

  it("creates a topic row with a unique slug when an existing topic already uses the base slug", async () => {
    const app = buildApp();

    const updateResponse = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/topics/work-from-home",
      body: {
        slug: "remote-work",
      },
    });
    const createResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/topics",
      body: {
        name: "Remote Work",
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: "remote-work-2",
      name: "Remote Work",
      slug: "remote-work-2",
      spotlightDeals: 0,
      status: "Draft",
      owner: "Admin topics",
    });
  });

  it("updates a topic row and returns the saved fields in subsequent topic requests", async () => {
    const app = buildApp();

    const updateResponse = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/topics/work-from-home",
      body: {
        name: "Remote Work",
        slug: "remote-work",
        status: "Archived",
        owner: "Editorial desk",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual({
      id: "work-from-home",
      name: "Remote Work",
      slug: "remote-work",
      spotlightDeals: 6,
      status: "Archived",
      owner: "Editorial desk",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: expect.arrayContaining([
        {
          id: "work-from-home",
          name: "Remote Work",
          slug: "remote-work",
          spotlightDeals: 6,
          status: "Archived",
          owner: "Editorial desk",
        },
      ]),
    });
  });

  it("deletes a topic row and removes it from subsequent topic requests", async () => {
    const app = buildApp();

    const deleteResponse = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/topics/work-from-home",
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeUndefined();
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
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

  it("returns not found when deleting an unknown topic row", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/topics/unknown-topic",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Topic not found.",
    });
  });

  it("rejects duplicate topic slugs during topic updates", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/topics/work-from-home",
      body: {
        slug: "gaming-setup",
      },
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Slug already exists.",
    });
  });
});
