import { describe, expect, it } from "vitest";

import {
  resolveLeadReviewEvidence,
  resolveLeadSourceEvidence,
} from "./leadSourceEvidence";

describe("lead source evidence", () => {
  it("prefers explicit raw fields over source snapshot values", () => {
    const sourceSnapshot = JSON.stringify({
      candidate: {
        title: "Snapshot title",
        url: "https://snapshot.example/deal",
        snippet: "Snapshot snippet",
      },
    });

    expect(
      resolveLeadSourceEvidence({
        originalTitle: "Manual title",
        originalUrl: "https://manual.example/deal",
        snippet: "Manual snippet",
        sourceSnapshot,
      }),
    ).toEqual({
      originalTitle: "Manual title",
      originalUrl: "https://manual.example/deal",
      snippet: "Manual snippet",
      sourceSnapshot,
    });
  });

  it("prefers candidate fields before rawEvidence fallbacks", () => {
    expect(
      resolveLeadSourceEvidence({
        originalTitle: "",
        originalUrl: "",
        snippet: "",
        sourceSnapshot: JSON.stringify({
          candidate: {
            title: "Candidate title",
            url: "https://candidate.example/deal",
            snippet: "Candidate snippet",
          },
          rawEvidence: {
            originalTitle: "Raw evidence title",
            originalUrl: "https://raw.example/deal",
            snippet: "Raw evidence snippet",
          },
        }),
      }),
    ).toEqual({
      originalTitle: "Candidate title",
      originalUrl: "https://candidate.example/deal",
      snippet: "Candidate snippet",
      sourceSnapshot: JSON.stringify({
        candidate: {
          title: "Candidate title",
          url: "https://candidate.example/deal",
          snippet: "Candidate snippet",
        },
        rawEvidence: {
          originalTitle: "Raw evidence title",
          originalUrl: "https://raw.example/deal",
          snippet: "Raw evidence snippet",
        },
      }),
    });
  });

  it("falls back to rawEvidence fields when the manual payload is blank", () => {
    const sourceSnapshot = JSON.stringify({
      rawEvidence: {
        title: "Raw evidence title",
        canonicalUrl: "https://raw.example/deal",
        excerpt: "Raw evidence snippet",
      },
    });

    expect(
      resolveLeadSourceEvidence({
        originalTitle: "",
        originalUrl: "",
        snippet: "",
        sourceSnapshot,
      }),
    ).toEqual({
      originalTitle: "Raw evidence title",
      originalUrl: "https://raw.example/deal",
      snippet: "Raw evidence snippet",
      sourceSnapshot,
    });
  });

  it("returns blank fallbacks when the source snapshot is not parseable", () => {
    expect(
      resolveLeadSourceEvidence({
        originalTitle: "",
        originalUrl: "",
        snippet: "",
        sourceSnapshot: "{not-json",
      }),
    ).toEqual({
      originalTitle: "",
      originalUrl: "",
      snippet: "",
      sourceSnapshot: "{not-json",
    });
  });

  it("resolves review evidence from the shared source evidence contract", () => {
    expect(
      resolveLeadReviewEvidence({
        originalTitle: "",
        snippet: "",
        sourceSnapshot: JSON.stringify({
          candidate: {
            title: "Candidate title",
            summary: "Candidate snippet",
          },
        }),
      }),
    ).toEqual({
      originalTitle: "Candidate title",
      snippet: "Candidate snippet",
    });
  });
});
