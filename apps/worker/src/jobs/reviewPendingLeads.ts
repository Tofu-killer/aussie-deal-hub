import { reviewLead, type LeadReview } from "@aussie-deal-hub/ai/reviewLead";

export interface PendingLeadRecord {
  id: string;
  originalTitle: string;
  snippet: string;
  reviewStatus: string;
}

export interface ReviewPendingLeadsOptions {
  reviewedAt?: string;
}

type ReviewLocale = keyof LeadReview["locales"];

export interface ReviewedLeadRecord extends PendingLeadRecord {
  reviewStatus: "reviewed";
  reviewedAt: string;
  category: LeadReview["category"];
  aiConfidence: number;
  riskLabels: string[];
  localizedHints: ReviewLocale[];
  locales: LeadReview["locales"];
}

export function reviewPendingLeads(
  leads: PendingLeadRecord[],
  options: ReviewPendingLeadsOptions = {},
): ReviewedLeadRecord[] {
  const reviewedAt = options.reviewedAt ?? new Date().toISOString();

  return leads.flatMap((lead) => {
    if (lead.reviewStatus !== "pending") {
      return [];
    }

    const review = reviewLead({
      originalTitle: lead.originalTitle,
      snippet: lead.snippet,
    });

    return [
      {
        ...lead,
        reviewStatus: "reviewed",
        reviewedAt,
        category: review.category,
        aiConfidence: review.confidence,
        riskLabels: review.riskLabels,
        localizedHints: Object.keys(review.locales) as ReviewLocale[],
        locales: review.locales,
      },
    ];
  });
}
