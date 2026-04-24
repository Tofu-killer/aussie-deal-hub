import { extractLeadCandidates } from "../../../../packages/scraping/src/extractLeadCandidates.ts";
import { normalizeLead } from "../../../../packages/scraping/src/normalizeLead.ts";

export interface IngestibleSourceRecord {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  trustScore: number;
  language: string;
}

export interface IngestLeadStore {
  createLeadIfNew(input: {
    sourceId: string;
    originalTitle: string;
    originalUrl: string;
    canonicalUrl: string;
    snippet: string;
    merchant?: string;
    localizedHints?: string[];
  }): Promise<{ created: boolean }>;
}

export interface SourcePollRecorder {
  recordSourcePoll(input: {
    sourceId: string;
    createdLeadCount: number;
    message: string;
    status: "error" | "ok";
  }): Promise<void>;
}

export interface SourceFetcher {
  fetch(input: { url: string }): Promise<{ body: string; contentType: string | null }>;
}

export interface IngestEnabledSourcesSummary {
  createdLeadCount: number;
  createdLeadIds: string[];
  polledSourceCount: number;
  sourceResults: Array<{
    createdLeadCount: number;
    sourceId: string;
    status: "error" | "ok";
  }>;
}

const DEFAULT_INGEST_LIMIT_PER_SOURCE = 5;

export async function ingestEnabledSources(
  sources: IngestibleSourceRecord[],
  leadStore: IngestLeadStore,
  pollRecorder: SourcePollRecorder,
  sourceFetcher: SourceFetcher,
): Promise<IngestEnabledSourcesSummary> {
  const summary: IngestEnabledSourcesSummary = {
    createdLeadCount: 0,
    createdLeadIds: [],
    polledSourceCount: sources.length,
    sourceResults: [],
  };

  for (const source of sources) {
    try {
      const fetched = await sourceFetcher.fetch({ url: source.baseUrl });
      const candidates = extractLeadCandidates({
        body: fetched.body,
        contentType: fetched.contentType,
        sourceName: source.name,
        sourceType: source.sourceType,
        sourceUrl: source.baseUrl,
      }).slice(0, DEFAULT_INGEST_LIMIT_PER_SOURCE);
      let createdForSource = 0;

      for (const candidate of candidates) {
        const normalized = normalizeLead(candidate);
        const ingested = await leadStore.createLeadIfNew({
          sourceId: source.id,
          originalTitle: candidate.title,
          originalUrl: candidate.url,
          canonicalUrl: normalized.canonicalUrl,
          snippet: candidate.snippet,
          merchant: normalized.merchant,
          localizedHints: normalized.localizedHints,
        });

        if (ingested.created) {
          createdForSource += 1;
          summary.createdLeadCount += 1;
          summary.createdLeadIds.push(normalized.canonicalUrl);
        }
      }

      await pollRecorder.recordSourcePoll({
        sourceId: source.id,
        createdLeadCount: createdForSource,
        message: `Fetched ${candidates.length} candidates; created ${createdForSource} leads.`,
        status: "ok",
      });
      summary.sourceResults.push({
        sourceId: source.id,
        createdLeadCount: createdForSource,
        status: "ok",
      });
    } catch (error) {
      await pollRecorder.recordSourcePoll({
        sourceId: source.id,
        createdLeadCount: 0,
        message: error instanceof Error ? error.message : String(error),
        status: "error",
      });
      summary.sourceResults.push({
        sourceId: source.id,
        createdLeadCount: 0,
        status: "error",
      });
    }
  }

  return summary;
}
