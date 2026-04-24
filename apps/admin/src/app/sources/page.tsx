"use client";

import React, { useEffect, useState } from "react";

interface SourceItem {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  trustScore: number;
  language: string;
  enabled: boolean;
  pollCount: number;
  lastPolledAt: string | null;
  lastPollStatus: string | null;
  lastPollMessage: string | null;
  lastLeadCreatedAt: string | null;
}

interface SourcesResponse {
  items: SourceItem[];
}

interface SourceLoadResult {
  items: SourceItem[];
  error: string | null;
}

interface SourceUpdateResult {
  source: SourceItem | null;
  error: string | null;
}

interface CreateSourceInput {
  name: string;
  baseUrl: string;
  language: string;
  trustScore: number;
}

interface CreateSourceFormState {
  name: string;
  baseUrl: string;
  language: string;
  trustScore: string;
}

const emptyCreateSourceForm: CreateSourceFormState = {
  name: "",
  baseUrl: "",
  language: "",
  trustScore: "",
};

async function listSources(): Promise<SourceLoadResult> {
  try {
    const response = await fetch("/v1/admin/sources", {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load sources.",
      };
    }

    const body = (await response.json()) as SourcesResponse;
    return {
      items: Array.isArray(body.items) ? body.items : [],
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load sources.",
    };
  }
}

async function updateSourceEnabled(sourceId: string, enabled: boolean): Promise<SourceUpdateResult> {
  try {
    const response = await fetch(`/v1/admin/sources/${sourceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      return {
        source: null,
        error: "Failed to update source.",
      };
    }

    return {
      source: (await response.json()) as SourceItem,
      error: null,
    };
  } catch {
    return {
      source: null,
      error: "Failed to update source.",
    };
  }
}

async function createSource(input: CreateSourceInput): Promise<SourceUpdateResult> {
  try {
    const response = await fetch("/v1/admin/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        source: null,
        error: "Failed to create source.",
      };
    }

    return {
      source: (await response.json()) as SourceItem,
      error: null,
    };
  } catch {
    return {
      source: null,
      error: "Failed to create source.",
    };
  }
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingSourceIds, setUpdatingSourceIds] = useState<string[]>([]);
  const [createSourceForm, setCreateSourceForm] =
    useState<CreateSourceFormState>(emptyCreateSourceForm);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      const result = await listSources();

      if (cancelled) {
        return;
      }

      setSources(result.items);
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(source: SourceItem) {
    setFeedback(null);
    setUpdatingSourceIds((currentIds) =>
      currentIds.includes(source.id) ? currentIds : [...currentIds, source.id],
    );

    const result = await updateSourceEnabled(source.id, !source.enabled);

    setUpdatingSourceIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== source.id),
    );

    if (result.error || !result.source) {
      setFeedback("Failed to update source.");
      return;
    }

    setSources((currentSources) =>
      currentSources.map((currentSource) =>
        currentSource.id === source.id ? result.source ?? currentSource : currentSource,
      ),
    );
    setFeedback("Source updated.");
  }

  async function handleCreateSourceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsCreating(true);

    const result = await createSource({
      name: createSourceForm.name.trim(),
      baseUrl: createSourceForm.baseUrl.trim(),
      language: createSourceForm.language.trim(),
      trustScore: Number(createSourceForm.trustScore),
    });

    setIsCreating(false);

    if (result.error || !result.source) {
      setFeedback("Failed to create source.");
      return;
    }

    setSources((currentSources) => [result.source, ...currentSources]);
    setError(null);
    setCreateSourceForm(emptyCreateSourceForm);
    setFeedback("Source created.");
  }

  function getPollSummary(source: SourceItem) {
    if (!source.lastPolledAt) {
      return "Never polled";
    }

    const status = source.lastPollStatus ?? "unknown";
    const message = source.lastPollMessage ?? "No details.";

    return `${status}: ${message}`;
  }

  return (
    <main>
      <h1>Sources</h1>
      <p>Review source quality and availability for ingestion.</p>
      <form
        onSubmit={(event) => {
          void handleCreateSourceSubmit(event);
        }}
      >
        <div>
          <label htmlFor="source-name">Name</label>
          <input
            id="source-name"
            name="name"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                name: event.target.value,
              }));
            }}
            required
            type="text"
            value={createSourceForm.name}
          />
        </div>
        <div>
          <label htmlFor="source-base-url">Base URL</label>
          <input
            id="source-base-url"
            name="baseUrl"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                baseUrl: event.target.value,
              }));
            }}
            required
            type="url"
            value={createSourceForm.baseUrl}
          />
        </div>
        <div>
          <label htmlFor="source-language">Language</label>
          <input
            id="source-language"
            name="language"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                language: event.target.value,
              }));
            }}
            required
            type="text"
            value={createSourceForm.language}
          />
        </div>
        <div>
          <label htmlFor="source-trust-score">Trust score</label>
          <input
            id="source-trust-score"
            min="0"
            name="trustScore"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                trustScore: event.target.value,
              }));
            }}
            required
            step="1"
            type="number"
            value={createSourceForm.trustScore}
          />
        </div>
        <button disabled={isCreating} type="submit">
          Create source
        </button>
      </form>
      {feedback ? <p aria-live="polite">{feedback}</p> : null}
      {error ? (
        <p>{error}</p>
      ) : isLoading ? (
        <p>Loading sources.</p>
      ) : sources.length === 0 ? (
        <p>No sources available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Base URL</th>
              <th>Trust score</th>
              <th>Language</th>
              <th>Last poll</th>
              <th>Last lead</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>{source.name}</td>
                <td>{source.sourceType}</td>
                <td>{source.baseUrl}</td>
                <td>{source.trustScore}</td>
                <td>{source.language}</td>
                <td>{getPollSummary(source)}</td>
                <td>{source.lastLeadCreatedAt ?? "No leads yet"}</td>
                <td>
                  {source.enabled ? "Enabled" : "Disabled"}{" "}
                  <button
                    disabled={updatingSourceIds.includes(source.id)}
                    onClick={() => {
                      void handleToggle(source);
                    }}
                    type="button"
                  >
                    {source.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
