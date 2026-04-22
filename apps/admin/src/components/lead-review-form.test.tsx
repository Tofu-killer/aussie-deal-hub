import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AdminHomePage from "../app/page";
import LeadDetailPage from "../app/leads/[leadId]/page";
import LeadsPage from "../app/leads/page";
import { LeadReviewForm, type LeadReviewDraft } from "./LeadReviewForm";

describe("LeadReviewForm", () => {
  it("submits edited bilingual content as a publish action", async () => {
    const user = userEvent.setup();
    const initialReview: LeadReviewDraft = {
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
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

    await user.clear(englishTitle);
    await user.type(englishTitle, "Nintendo Switch OLED bundle for A$399 at Amazon AU");
    await user.clear(englishSummary);
    await user.type(englishSummary, "Updated English summary.");
    await user.clear(chineseTitle);
    await user.type(chineseTitle, "亚马逊澳洲 Nintendo Switch OLED 套装到手 A$399");
    await user.clear(chineseSummary);
    await user.type(chineseSummary, "更新后的中文摘要。");
    await user.click(screen.getByRole("button", { name: "Publish Deal" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      leadId: "lead_42",
      category: "Deals",
      confidence: 88,
      riskLabels: ["Limited stock"],
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

  it("renders minimal admin page shells for root, leads, and lead detail", async () => {
    expect(renderToStaticMarkup(<AdminHomePage />)).toContain("Admin review dashboard");
    expect(renderToStaticMarkup(<AdminHomePage />)).toContain("/leads");

    expect(renderToStaticMarkup(<LeadsPage />)).toContain("Lead queue");
    expect(renderToStaticMarkup(<LeadsPage />)).toContain("lead_1");

    const leadDetailTree = await LeadDetailPage({
      params: Promise.resolve({ leadId: "lead_42" }),
    });
    const leadDetailMarkup = renderToStaticMarkup(leadDetailTree);

    expect(leadDetailMarkup).toContain("Lead lead_42");
    expect(leadDetailMarkup).toContain("Publish Deal");
  });
});
