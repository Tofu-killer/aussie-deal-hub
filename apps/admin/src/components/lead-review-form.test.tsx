import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminHomePage from "../app/page";
import LeadDetailPage from "../app/leads/[leadId]/page";
import LeadsPage from "../app/leads/page";
import { LeadReviewForm, type LeadReviewDraft } from "./LeadReviewForm";

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

async function renderResolvedPage(tree: ReturnType<typeof LeadsPage>) {
  render(await Promise.resolve(tree));
}

async function renderAdminHomePageToStaticMarkup() {
  if (AdminHomePage.constructor.name === "AsyncFunction") {
    return renderToStaticMarkup(await Promise.resolve(AdminHomePage()));
  }

  return renderToStaticMarkup(<AdminHomePage />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("LeadReviewForm", () => {
  it("submits edited bilingual content as a publish action", async () => {
    const user = userEvent.setup();
    const initialReview: LeadReviewDraft = {
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
      tags: ["gaming"],
      featuredSlot: "sidebar",
      publishAt: "2026-04-23T09:00",
      locales: {
        en: {
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Original English summary.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "原始中文摘要。",
        },
      },
    };
    const onSubmit = vi.fn();

    render(
      <LeadReviewForm
        initialReview={initialReview}
        leadId="lead_42"
        onSubmit={onSubmit}
      />,
    );

    const englishTitle = screen.getByLabelText("English title");
    const englishSummary = screen.getByLabelText("English summary");
    const chineseTitle = screen.getByLabelText("Chinese title");
    const chineseSummary = screen.getByLabelText("Chinese summary");
    const tags = screen.getByLabelText("Tags");
    const featuredSlot = screen.getByLabelText("Featured slot");
    const publishAt = screen.getByLabelText("Publish at");

    await user.clear(englishTitle);
    await user.type(englishTitle, "Nintendo Switch OLED bundle for A$399 at Amazon AU");
    await user.clear(englishSummary);
    await user.type(englishSummary, "Updated English summary.");
    await user.clear(chineseTitle);
    await user.type(chineseTitle, "亚马逊澳洲 Nintendo Switch OLED 套装到手 A$399");
    await user.clear(chineseSummary);
    await user.type(chineseSummary, "更新后的中文摘要。");
    await user.clear(tags);
    await user.type(tags, "gaming, console, hot");
    await user.clear(featuredSlot);
    await user.type(featuredSlot, "hero");
    await user.clear(publishAt);
    await user.type(publishAt, "2026-04-24T10:30");
    await user.click(screen.getByRole("button", { name: "Publish Deal" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      leadId: "lead_42",
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
      tags: ["gaming", "console", "hot"],
      featuredSlot: "hero",
      publishAt: new Date("2026-04-24T10:30").toISOString(),
      locales: {
        en: {
          title: "Nintendo Switch OLED bundle for A$399 at Amazon AU",
          summary: "Updated English summary.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 套装到手 A$399",
          summary: "更新后的中文摘要。",
        },
      },
      publish: true,
    });
  });

  it("submits metadata on save draft with publishAt normalized to UTC ISO", async () => {
    const user = userEvent.setup();
    const initialReview: LeadReviewDraft = {
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
      tags: ["gaming"],
      featuredSlot: "sidebar",
      publishAt: "2026-04-23T09:00",
      locales: {
        en: {
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Original English summary.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "原始中文摘要。",
        },
      },
    };
    const onSubmit = vi.fn();

    render(
      <LeadReviewForm
        initialReview={initialReview}
        leadId="lead_77"
        onSubmit={onSubmit}
      />,
    );

    const tags = screen.getByLabelText("Tags");
    const featuredSlot = screen.getByLabelText("Featured slot");
    const publishAt = screen.getByLabelText("Publish at");

    await user.clear(tags);
    await user.type(tags, "flash, top-pick");
    await user.clear(featuredSlot);
    await user.type(featuredSlot, "slot-b");
    await user.clear(publishAt);
    await user.type(publishAt, "2026-05-01T08:15");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead_77",
        tags: ["flash", "top-pick"],
        featuredSlot: "slot-b",
        publishAt: new Date("2026-05-01T08:15").toISOString(),
        publish: false,
      }),
    );
  });

  it("renders ISO publishAt as local datetime-local value", () => {
    const initialReview: LeadReviewDraft = {
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
      tags: ["gaming"],
      featuredSlot: "sidebar",
      publishAt: "2026-04-24T02:30:00.000Z",
      locales: {
        en: {
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Original English summary.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "原始中文摘要。",
        },
      },
    };

    render(
      <LeadReviewForm
        initialReview={initialReview}
        leadId="lead_88"
      />,
    );

    expect((screen.getByLabelText("Publish at") as HTMLInputElement).value).toBe(
      toLocalInputValue(initialReview.publishAt),
    );
  });

  it("renders the admin home page with a lead queue link", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const markup = await renderAdminHomePageToStaticMarkup();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(markup).toContain("Admin review dashboard");
    expect(markup).toContain("/leads");
  });

  it("loads and renders the lead queue from the admin leads API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        items: [
          {
            id: "lead_42",
            sourceId: "src_amazon",
            originalTitle: "Amazon AU Nintendo Switch OLED A$399",
            originalUrl: "https://www.amazon.com.au/deal",
            snippet: "Coupon GAME20 expires tonight.",
            createdAt: "2026-04-23T08:00:00.000Z",
            queue: {
              status: "draft_saved",
              label: "Draft saved",
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderResolvedPage(LeadsPage());

    expect(fetchMock).toHaveBeenCalledWith("http://preview-api.test/v1/admin/leads", {
      cache: "no-store",
    });
    expect(screen.getByRole("heading", { name: "Lead queue" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "lead_42" }).getAttribute("href")).toBe(
      "/leads/lead_42",
    );
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Draft saved")).toBeTruthy();
    expect(screen.getByText("src_amazon")).toBeTruthy();
    expect(screen.getByText("Amazon AU Nintendo Switch OLED A$399")).toBeTruthy();
    expect(screen.getByText("https://www.amazon.com.au/deal")).toBeTruthy();
  });

  it("renders published queue status fallback labels", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          items: [
            {
              id: "lead_published",
              sourceId: "src_bigw",
              originalTitle: "Big W LEGO Bonsai Tree A$59",
              originalUrl: "https://www.bigw.com.au/deal/lego-bonsai",
              snippet: "Weekend toy sale.",
              createdAt: "2026-04-23T08:00:00.000Z",
              queue: {
                status: "published",
              },
            },
          ],
        }),
      ),
    );

    await renderResolvedPage(LeadsPage());

    expect(screen.getByText("Published")).toBeTruthy();
  });

  it("loads lead detail metadata from the admin leads API and renders the review form", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: "lead_42",
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
        createdAt: "2026-04-23T08:00:00.000Z",
        review: {
          category: "Deals",
          confidence: 88,
          riskLabels: ["Limited stock"],
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
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailPage params={Promise.resolve({ leadId: "lead_42" })} />);

    expect(await screen.findByRole("heading", { name: "Lead lead_42" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("http://preview-api.test/v1/admin/leads/lead_42", {
      cache: "no-store",
    });
    expect(await screen.findByText("src_amazon")).toBeTruthy();
    expect(screen.getByText("Amazon AU Nintendo Switch OLED A$399")).toBeTruthy();
    expect(screen.getByText("https://www.amazon.com.au/deal")).toBeTruthy();
    expect(screen.getAllByText("Coupon GAME20 expires tonight.").length).toBeGreaterThan(0);
    expect((await screen.findByLabelText("English title") as HTMLInputElement).value).toBe(
      "Nintendo Switch OLED for A$399 at Amazon AU",
    );
    expect((screen.getByLabelText("Chinese title") as HTMLInputElement).value).toBe(
      "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
    );
    expect(screen.getByRole("button", { name: "Publish Deal" })).toBeTruthy();
  });

  it("loads a new lead detail and renders the deterministic AI preview instead of weak local defaults", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const leadId = "lead_42";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: leadId,
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
        createdAt: "2026-04-23T08:00:00.000Z",
        review: {
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
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailPage params={Promise.resolve({ leadId })} />);

    expect(await screen.findByRole("heading", { name: `Lead ${leadId}` })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("http://preview-api.test/v1/admin/leads/lead_42", {
      cache: "no-store",
    });
    expect((await screen.findByLabelText("English title") as HTMLInputElement).value).toBe(
      "Nintendo Switch OLED for A$399 at Amazon AU",
    );
    expect((screen.getByLabelText("Chinese title") as HTMLInputElement).value).toBe(
      "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
    );
    expect((screen.getByLabelText("Category") as HTMLInputElement).value).toBe("Deals");
    expect((screen.getByLabelText("Confidence") as HTMLInputElement).value).toBe("88");
    expect((screen.getByLabelText("Chinese summary") as HTMLTextAreaElement).value).toBe(
      "优惠码 GAME20 今晚到期。",
    );
    expect(screen.queryByDisplayValue("Uncategorized")).toBeNull();
  });

  it("submits the lead review draft to the admin review write route and shows success feedback", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "http://preview-api.test/v1/admin/leads/lead_42") {
        return createJsonResponse({
          id: "lead_42",
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          createdAt: "2026-04-23T08:00:00.000Z",
          review: {
            category: "Deals",
            confidence: 88,
            riskLabels: ["Limited stock"],
            tags: ["gaming"],
            featuredSlot: "sidebar",
            publishAt: "2026-04-24T09:00:00.000Z",
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
          },
        });
      }

      if (url === "http://preview-api.test/v1/admin/leads/lead_42/review" && init?.method === "PUT") {
        return createJsonResponse({ ok: true });
      }

      return createJsonResponse({ message: `Unexpected fetch for ${url}` }, false);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LeadDetailPage params={Promise.resolve({ leadId: "lead_42" })} />);

    expect(await screen.findByDisplayValue("Nintendo Switch OLED for A$399 at Amazon AU")).toBeTruthy();

    await user.clear(screen.getByLabelText("Tags"));
    await user.type(screen.getByLabelText("Tags"), "gaming, console");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://preview-api.test/v1/admin/leads/lead_42/review", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: "lead_42",
        category: "Deals",
        confidence: 88,
        riskLabels: ["Limited stock"],
        tags: ["gaming", "console"],
        featuredSlot: "sidebar",
        publishAt: "2026-04-24T09:00:00.000Z",
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
        publish: false,
      }),
    });
    expect(await screen.findByText("Draft saved.")).toBeTruthy();
  });

  it("saves the review draft before calling the publish route and shows publish success feedback", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "http://preview-api.test/v1/admin/leads/lead_42") {
        return createJsonResponse({
          id: "lead_42",
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          createdAt: "2026-04-23T08:00:00.000Z",
          review: {
            category: "Deals",
            confidence: 88,
            riskLabels: ["Limited stock"],
            tags: ["gaming"],
            featuredSlot: "sidebar",
            publishAt: "2026-04-24T09:00:00.000Z",
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
          },
        });
      }

      if (url === "http://preview-api.test/v1/admin/leads/lead_42/review" && init?.method === "PUT") {
        return createJsonResponse({ ok: true });
      }

      if (url === "http://preview-api.test/v1/admin/publishing/lead_42/publish" && init?.method === "POST") {
        return createJsonResponse({ ok: true });
      }

      return createJsonResponse({ message: `Unexpected fetch for ${url}` }, false);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LeadDetailPage params={Promise.resolve({ leadId: "lead_42" })} />);

    expect(await screen.findByDisplayValue("Nintendo Switch OLED for A$399 at Amazon AU")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish Deal" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://preview-api.test/v1/admin/leads/lead_42/review", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: "lead_42",
        category: "Deals",
        confidence: 88,
        riskLabels: ["Limited stock"],
        tags: ["gaming"],
        featuredSlot: "sidebar",
        publishAt: "2026-04-24T09:00:00.000Z",
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
        publish: false,
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://preview-api.test/v1/admin/publishing/lead_42/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: "lead_42",
        category: "Deals",
        confidence: 88,
        riskLabels: ["Limited stock"],
        tags: ["gaming"],
        featuredSlot: "sidebar",
        publishAt: "2026-04-24T09:00:00.000Z",
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
        publish: true,
      }),
    });
    expect(await screen.findByText("Deal queued for publishing.")).toBeTruthy();
  });

  it("shows failure feedback when saving the review draft before publishing fails", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "http://preview-api.test/v1/admin/leads/lead_42") {
        return createJsonResponse({
          id: "lead_42",
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          createdAt: "2026-04-23T08:00:00.000Z",
          review: {
            category: "Deals",
            confidence: 88,
            riskLabels: ["Limited stock"],
            tags: ["gaming"],
            featuredSlot: "sidebar",
            publishAt: "2026-04-24T09:00:00.000Z",
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
          },
        });
      }

      if (url === "http://preview-api.test/v1/admin/leads/lead_42/review" && init?.method === "PUT") {
        return createJsonResponse({ message: "write failed" }, false);
      }

      return createJsonResponse({ message: `Unexpected fetch for ${url}` }, false);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LeadDetailPage params={Promise.resolve({ leadId: "lead_42" })} />);

    expect(await screen.findByDisplayValue("Nintendo Switch OLED for A$399 at Amazon AU")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish Deal" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Failed to save review before publishing.")).toBeTruthy();
  });

  it("shows failure feedback when the publish route rejects the submission after saving the draft", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "http://preview-api.test/v1/admin/leads/lead_42") {
        return createJsonResponse({
          id: "lead_42",
          sourceId: "src_amazon",
          originalTitle: "Amazon AU Nintendo Switch OLED A$399",
          originalUrl: "https://www.amazon.com.au/deal",
          snippet: "Coupon GAME20 expires tonight.",
          createdAt: "2026-04-23T08:00:00.000Z",
          review: {
            category: "Deals",
            confidence: 88,
            riskLabels: ["Limited stock"],
            tags: ["gaming"],
            featuredSlot: "sidebar",
            publishAt: "2026-04-24T09:00:00.000Z",
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
          },
        });
      }

      if (url === "http://preview-api.test/v1/admin/leads/lead_42/review" && init?.method === "PUT") {
        return createJsonResponse({ ok: true });
      }

      if (url === "http://preview-api.test/v1/admin/publishing/lead_42/publish" && init?.method === "POST") {
        return createJsonResponse({ message: "publish failed" }, false);
      }

      return createJsonResponse({ message: `Unexpected fetch for ${url}` }, false);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LeadDetailPage params={Promise.resolve({ leadId: "lead_42" })} />);

    expect(await screen.findByDisplayValue("Nintendo Switch OLED for A$399 at Amazon AU")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish Deal" }));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await screen.findByText("Draft saved, but failed to queue deal for publishing.")).toBeTruthy();
  });
});
