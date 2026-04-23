import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("admin catalog routes", () => {
  it("lists deterministic merchant catalog rows for admin pages", async () => {
    const app = buildApp();

    const firstResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });
    const secondResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body).toEqual(secondResponse.body);
    expect(firstResponse.body).toEqual({
      items: [
        {
          id: "amazon-au",
          name: "Amazon AU",
          activeDeals: 42,
          primaryCategory: "Electronics",
          status: "Active",
          owner: "Marketplace desk",
        },
        {
          id: "chemist-warehouse",
          name: "Chemist Warehouse",
          activeDeals: 17,
          primaryCategory: "Health",
          status: "Needs review",
          owner: "Retail desk",
        },
        {
          id: "the-iconic",
          name: "The Iconic",
          activeDeals: 9,
          primaryCategory: "Fashion",
          status: "Active",
          owner: "Lifestyle desk",
        },
      ],
    });
  });

  it("lists deterministic tag catalog rows for admin pages", async () => {
    const app = buildApp();

    const firstResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });
    const secondResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body).toEqual(secondResponse.body);
    expect(firstResponse.body).toEqual({
      items: [
        {
          id: "gaming",
          name: "Gaming",
          slug: "gaming",
          visibleDeals: 18,
          localization: "EN + ZH ready",
          owner: "Discovery desk",
        },
        {
          id: "grocery",
          name: "Grocery",
          slug: "grocery",
          visibleDeals: 25,
          localization: "EN + ZH ready",
          owner: "Everyday desk",
        },
        {
          id: "travel",
          name: "Travel",
          slug: "travel",
          visibleDeals: 7,
          localization: "Needs ZH review",
          owner: "Lifestyle desk",
        },
      ],
    });
  });

  it("creates a merchant row and returns it in subsequent merchant catalog requests", async () => {
    const app = buildApp();

    const createResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/merchants",
      body: {
        name: "JB Hi-Fi",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: "jb-hi-fi",
      name: "JB Hi-Fi",
      activeDeals: 0,
      primaryCategory: "Unassigned",
      status: "Draft",
      owner: "Admin catalog",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
        {
          id: "jb-hi-fi",
          name: "JB Hi-Fi",
          activeDeals: 0,
          primaryCategory: "Unassigned",
          status: "Draft",
          owner: "Admin catalog",
        },
        {
          id: "amazon-au",
          name: "Amazon AU",
          activeDeals: 42,
          primaryCategory: "Electronics",
          status: "Active",
          owner: "Marketplace desk",
        },
        {
          id: "chemist-warehouse",
          name: "Chemist Warehouse",
          activeDeals: 17,
          primaryCategory: "Health",
          status: "Needs review",
          owner: "Retail desk",
        },
        {
          id: "the-iconic",
          name: "The Iconic",
          activeDeals: 9,
          primaryCategory: "Fashion",
          status: "Active",
          owner: "Lifestyle desk",
        },
      ],
    });
  });

  it("creates a tag row and returns it in subsequent tag catalog requests", async () => {
    const app = buildApp();

    const createResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/tags",
      body: {
        name: "Home Office",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: "home-office",
      name: "Home Office",
      slug: "home-office",
      visibleDeals: 0,
      localization: "Needs localization",
      owner: "Admin catalog",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
        {
          id: "home-office",
          name: "Home Office",
          slug: "home-office",
          visibleDeals: 0,
          localization: "Needs localization",
          owner: "Admin catalog",
        },
        {
          id: "gaming",
          name: "Gaming",
          slug: "gaming",
          visibleDeals: 18,
          localization: "EN + ZH ready",
          owner: "Discovery desk",
        },
        {
          id: "grocery",
          name: "Grocery",
          slug: "grocery",
          visibleDeals: 25,
          localization: "EN + ZH ready",
          owner: "Everyday desk",
        },
        {
          id: "travel",
          name: "Travel",
          slug: "travel",
          visibleDeals: 7,
          localization: "Needs ZH review",
          owner: "Lifestyle desk",
        },
      ],
    });
  });
});
