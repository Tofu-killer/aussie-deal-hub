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

  it("updates a merchant row and returns the saved fields in subsequent merchant catalog requests", async () => {
    const app = buildApp();

    const updateResponse = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/merchants/amazon-au",
      body: {
        name: "Amazon Australia",
        primaryCategory: "Marketplace",
        status: "Paused",
        owner: "Commerce desk",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual({
      id: "amazon-au",
      name: "Amazon Australia",
      activeDeals: 42,
      primaryCategory: "Marketplace",
      status: "Paused",
      owner: "Commerce desk",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: expect.arrayContaining([
        {
          id: "amazon-au",
          name: "Amazon Australia",
          activeDeals: 42,
          primaryCategory: "Marketplace",
          status: "Paused",
          owner: "Commerce desk",
        },
      ]),
    });
  });

  it("creates a tag row with a unique slug when an existing tag already uses the base slug", async () => {
    const app = buildApp();

    const updateResponse = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/tags/travel",
      body: {
        slug: "home-office",
      },
    });
    const createResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/tags",
      body: {
        name: "Home Office",
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: "home-office-2",
      name: "Home Office",
      slug: "home-office-2",
      visibleDeals: 0,
      localization: "Needs localization",
      owner: "Admin catalog",
    });
  });

  it("deletes a merchant row and removes it from subsequent merchant catalog requests", async () => {
    const app = buildApp();

    const deleteResponse = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/merchants/amazon-au",
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeUndefined();
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
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

  it("returns not found when deleting an unknown merchant row", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/merchants/unknown-merchant",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Merchant not found.",
    });
  });

  it("updates a tag row and returns the saved fields in subsequent tag catalog requests", async () => {
    const app = buildApp();

    const updateResponse = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/tags/travel",
      body: {
        name: "Travel Deals",
        slug: "travel-deals",
        localization: "EN only",
        owner: "Merch desk",
      },
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual({
      id: "travel",
      name: "Travel Deals",
      slug: "travel-deals",
      visibleDeals: 7,
      localization: "EN only",
      owner: "Merch desk",
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: expect.arrayContaining([
        {
          id: "travel",
          name: "Travel Deals",
          slug: "travel-deals",
          visibleDeals: 7,
          localization: "EN only",
          owner: "Merch desk",
        },
      ]),
    });
  });

  it("deletes a tag row and removes it from subsequent tag catalog requests", async () => {
    const app = buildApp();

    const deleteResponse = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/tags/travel",
    });
    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeUndefined();
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
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
      ],
    });
  });

  it("returns not found when deleting an unknown tag row", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "DELETE",
      path: "/v1/admin/tags/unknown-tag",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Tag not found.",
    });
  });

  it("rejects duplicate tag slugs during tag updates", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/tags/travel",
      body: {
        slug: "grocery",
      },
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Slug already exists.",
    });
  });
});
