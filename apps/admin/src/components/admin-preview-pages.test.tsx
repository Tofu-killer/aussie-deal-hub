import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DigestPage from "../app/digest/page";
import IntakePage from "../app/intake/page";
import AdminHomePage from "../app/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ADMIN_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
});

async function renderAdminHomeMarkup() {
  return renderToStaticMarkup(await Promise.resolve(AdminHomePage()));
}

describe("admin preview pages", () => {
  it("renders intake and digest preview links on the admin home page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ message: "boom" }, false)),
    );

    const markup = await renderAdminHomeMarkup();

    expect(markup).toContain("/intake");
    expect(markup).toContain("/digest");
    expect(markup).toContain("Preview intake");
    expect(markup).toContain("Preview digest");
  });

  it("renders the intake form and previewed AI review content", async () => {
    const sourceSnapshot = JSON.stringify({
      source: "manual-intake",
      candidate: {
        title: "Amazon AU Nintendo Switch OLED A$399",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        category: "Deals",
        confidence: 88,
        riskLabels: [],
        locales: {
          en: {
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
            summary: "Coupon GAME20 expires tonight.",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            summary: "优惠码 GAME20 今晚到期。",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await IntakePage({
      searchParams: Promise.resolve({
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
        sourceSnapshot,
      }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Intake preview" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Original title") as HTMLInputElement).value,
    ).toBe("Amazon AU Nintendo Switch OLED A$399");
    expect(
      (screen.getByLabelText("Snippet") as HTMLTextAreaElement).value,
    ).toBe("Coupon GAME20 expires tonight.");
    expect(
      (screen.getByLabelText("Source snapshot") as HTMLTextAreaElement).value,
    ).toBe(sourceSnapshot);
    expect(
      screen.getByRole("button", { name: "Preview AI review" }).closest("form")?.getAttribute("method"),
    ).not.toBe("get");
    expect(await screen.findByText("Deals")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/admin/review-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          sourceSnapshot,
        }),
        cache: "no-store",
      },
    );
    expect(screen.getByText("88")).toBeTruthy();
    expect(
      screen.getByText("Nintendo Switch OLED for A$399 at Amazon AU"),
    ).toBeTruthy();
    expect(screen.getAllByText(sourceSnapshot)).toHaveLength(2);
    expect(screen.getByText("亚马逊澳洲 Nintendo Switch OLED 到手 A$399")).toBeTruthy();
    expect(screen.getByText("优惠码 GAME20 今晚到期。")).toBeTruthy();
  });

  it("renders intake handoff controls and failure feedback after previewing a lead", async () => {
    const sourceSnapshot = JSON.stringify({
      source: "manual-intake",
      candidate: {
        title: "Amazon AU Nintendo Switch OLED A$399",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        category: "Deals",
        confidence: 88,
        riskLabels: [],
        locales: {
          en: {
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
            summary: "Coupon GAME20 expires tonight.",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            summary: "优惠码 GAME20 今晚到期。",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await IntakePage({
      searchParams: Promise.resolve({
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
        sourceSnapshot,
        status: "handoff_error",
      }),
    });

    render(page);

    expect((screen.getByLabelText("Source ID") as HTMLInputElement).value).toBe("src_amazon");
    expect((screen.getByLabelText("Original URL") as HTMLInputElement).value).toBe(
      "https://www.amazon.com.au/deal",
    );
    expect((screen.getByLabelText("Source snapshot") as HTMLTextAreaElement).value).toBe(
      sourceSnapshot,
    );
    expect(screen.getByText("Failed to create lead.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Create lead" })).toBeTruthy();
  });

  it("keeps a large source snapshot in local state when create lead fails", async () => {
    const user = userEvent.setup();
    const sourceSnapshot = JSON.stringify({
      source: "manual-intake",
      candidate: {
        title: "Amazon AU Nintendo Switch OLED A$399",
        url: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
      rawEvidence: {
        oversized: "x".repeat(12_000),
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          category: "Deals",
          confidence: 88,
          riskLabels: [],
          locales: {
            en: {
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
              summary: "Coupon GAME20 expires tonight.",
            },
            zh: {
              title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
              summary: "优惠码 GAME20 今晚到期。",
            },
          },
        }),
      )
      .mockResolvedValueOnce(createJsonResponse({ message: "boom" }, false));
    vi.stubGlobal("fetch", fetchMock);

    const page = await IntakePage({
      searchParams: Promise.resolve({
        sourceId: "src_amazon",
        originalTitle: "",
        originalUrl: "",
        snippet: "",
        sourceSnapshot,
      }),
    });

    render(page);

    await screen.findByRole("button", { name: "Create lead" });
    await user.click(screen.getByRole("button", { name: "Create lead" }));

    expect(await screen.findByText("Failed to create lead.")).toBeTruthy();
    expect((screen.getByLabelText("Source snapshot") as HTMLTextAreaElement).value).toBe(
      sourceSnapshot,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("loads preview and enables handoff when the source snapshot supplies the missing raw evidence", async () => {
    const sourceSnapshot = JSON.stringify({
      source: "manual-intake",
      candidate: {
        title: "Amazon AU Nintendo Switch OLED A$399",
        url: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        category: "Deals",
        confidence: 88,
        riskLabels: [],
        locales: {
          en: {
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
            summary: "Coupon GAME20 expires tonight.",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            summary: "优惠码 GAME20 今晚到期。",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await IntakePage({
      searchParams: Promise.resolve({
        sourceId: "src_amazon",
        originalTitle: "",
        originalUrl: "",
        snippet: "",
        sourceSnapshot,
      }),
    });

    render(page);

    expect(await screen.findByRole("button", { name: "Create lead" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/admin/review-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalTitle: "",
          originalUrl: "",
          snippet: "",
          sourceSnapshot,
        }),
        cache: "no-store",
      },
    );
  });

  it("submits reviewed intake data to the admin leads API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://preview-api.test/v1/admin/leads");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          sourceSnapshot: "{\"source\":\"manual-intake\"}",
        }),
      );

      return new Response(
        JSON.stringify({
          id: "lead_42",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const intakeModule = (await import("../lib/intakeHandoff")) as {
      submitLeadHandoffFromForm?: (formData: FormData) => Promise<unknown>;
    };

    expect(intakeModule.submitLeadHandoffFromForm).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("sourceId", "src_amazon");
    formData.set("originalTitle", "Amazon AU Nintendo Switch OLED A$399");
    formData.set("originalUrl", "https://www.amazon.com.au/deal");
    formData.set("snippet", "Coupon GAME20 expires tonight.");
    formData.set("sourceSnapshot", "{\"source\":\"manual-intake\"}");

    await expect(intakeModule.submitLeadHandoffFromForm!(formData)).resolves.toEqual({
      status: "success",
      leadId: "lead_42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits snapshot-backed intake data even when the raw title, url, and snippet are blank", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const sourceSnapshot = JSON.stringify({
      source: "manual-intake",
      candidate: {
        title: "Amazon AU Nintendo Switch OLED A$399",
        url: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
    });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://preview-api.test/v1/admin/leads");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          sourceSnapshot,
        }),
      );

      return new Response(
        JSON.stringify({
          id: "lead_42",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const intakeModule = (await import("../lib/intakeHandoff")) as {
      submitLeadHandoffFromForm?: (formData: FormData) => Promise<unknown>;
    };

    expect(intakeModule.submitLeadHandoffFromForm).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("sourceId", "src_amazon");
    formData.set("originalTitle", "");
    formData.set("originalUrl", "");
    formData.set("snippet", "");
    formData.set("sourceSnapshot", sourceSnapshot);

    await expect(intakeModule.submitLeadHandoffFromForm!(formData)).resolves.toEqual({
      status: "success",
      leadId: "lead_42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders the digest preview returned by the admin preview API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.aussie-deal-hub.example";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        en: {
          locale: "en",
          subject: "Daily Deals Digest",
          html: "<section><h1>Today&apos;s picks</h1><section><h2>Amazon AU</h2><ul><li><strong>Nintendo Switch OLED for A$399 at Amazon AU</strong></li></ul></section></section>",
          deals: [
            {
              id: "nintendo-switch-oled-amazon-au",
              merchant: "Amazon AU",
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
            },
          ],
        },
        zh: {
          locale: "zh",
          subject: "每日捡漏摘要",
          html: "<section><h1>今日精选</h1><section><h2>亚马逊澳洲</h2><ul><li><strong>亚马逊澳洲 Nintendo Switch OLED 到手 A$399</strong></li></ul></section></section>",
          deals: [
            {
              id: "nintendo-switch-oled-amazon-au",
              merchant: "亚马逊澳洲",
              title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await DigestPage();

    render(page);

    expect(screen.getByRole("heading", { name: "Digest preview" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://preview-api.test/v1/admin/digest-preview",
      {
        cache: "no-store",
      },
    );
    expect(screen.getByText("Daily Deals Digest")).toBeTruthy();
    expect(screen.getByText("每日捡漏摘要")).toBeTruthy();
    expect(screen.getAllByText("Amazon AU").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Nintendo Switch OLED for A$399 at Amazon AU").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("https://www.aussie-deal-hub.example/en/deals/nintendo-switch-oled-amazon-au");
    expect(screen.getAllByText("亚马逊澳洲").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("亚马逊澳洲 Nintendo Switch OLED 到手 A$399").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", {
        name: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      }).getAttribute("href"),
    ).toBe("https://www.aussie-deal-hub.example/zh/deals/nintendo-switch-oled-amazon-au");
  });
});
