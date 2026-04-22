import React from "react";

import LeadReviewForm, { type LeadReviewDraft } from "../../../components/LeadReviewForm";

const DEFAULT_REVIEW: LeadReviewDraft = {
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

interface LeadDetailPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { leadId } = await params;

  return (
    <main>
      <h1>Lead {leadId}</h1>
      <p>Edit bilingual deal content and publish when it is ready.</p>
      <LeadReviewForm
        initialReview={DEFAULT_REVIEW}
        leadId={leadId}
      />
    </main>
  );
}
