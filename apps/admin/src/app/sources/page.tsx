"use client";

import React, { useEffect, useState } from "react";

const sourceFetchMethods = ["html", "json"] as const;

type SourceFetchMethod = (typeof sourceFetchMethods)[number];

interface SourceItem {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  fetchMethod: SourceFetchMethod;
  pollIntervalMinutes: number;
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

interface SourceUpdateInput {
  enabled?: boolean;
  fetchMethod?: SourceFetchMethod;
  pollIntervalMinutes?: number;
}

interface SourceUpdateResult {
  source: SourceItem | null;
  error: string | null;
}

interface CreateSourceInput {
  name: string;
  baseUrl: string;
  language: string;
  fetchMethod: SourceFetchMethod;
  pollIntervalMinutes: number;
  trustScore: number;
}

interface CreateSourceFormState {
  name: string;
  baseUrl: string;
  language: string;
  fetchMethod: SourceFetchMethod | "";
  pollIntervalMinutes: string;
  trustScore: string;
}

interface SourceSettingsFormState {
  fetchMethod: SourceFetchMethod;
  pollIntervalMinutes: string;
}

const emptyCreateSourceForm: CreateSourceFormState = {
  name: "",
  baseUrl: "",
  language: "",
  fetchMethod: "",
  pollIntervalMinutes: "",
  trustScore: "",
};

function buildSourceSettingsForm(source: SourceItem): SourceSettingsFormState {
  return {
    fetchMethod: source.fetchMethod,
    pollIntervalMinutes: String(source.pollIntervalMinutes),
  };
}

function buildSourceSettingsFormMap(sources: SourceItem[]) {
  return Object.fromEntries(
    sources.map((source) => [source.id, buildSourceSettingsForm(source)]),
  ) as Record<string, SourceSettingsFormState>;
}

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

async function updateSource(
  sourceId: string,
  input: SourceUpdateInput,
): Promise<SourceUpdateResult> {
  try {
    const response = await fetch(`/v1/admin/sources/${sourceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
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
  const [sourceSettingsForms, setSourceSettingsForms] = useState<
    Record<string, SourceSettingsFormState>
  >({});
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
      setSourceSettingsForms(buildSourceSettingsFormMap(result.items));
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  function markSourceUpdating(sourceId: string) {
    setUpdatingSourceIds((currentIds) =>
      currentIds.includes(sourceId) ? currentIds : [...currentIds, sourceId],
    );
  }

  function clearSourceUpdating(sourceId: string) {
    setUpdatingSourceIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== sourceId),
    );
  }

  function applyUpdatedSource(updatedSource: SourceItem) {
    setSources((currentSources) =>
      currentSources.map((currentSource) =>
        currentSource.id === updatedSource.id ? updatedSource : currentSource,
      ),
    );
    setSourceSettingsForms((currentForms) => ({
      ...currentForms,
      [updatedSource.id]: buildSourceSettingsForm(updatedSource),
    }));
  }

  async function handleToggle(source: SourceItem) {
    setFeedback(null);
    markSourceUpdating(source.id);

    const result = await updateSource(source.id, {
      enabled: !source.enabled,
    });

    clearSourceUpdating(source.id);

    if (result.error || !result.source) {
      setFeedback("Failed to update source.");
      return;
    }

    applyUpdatedSource(result.source);
    setFeedback("Source updated.");
  }

  async function handleSaveSettings(source: SourceItem) {
    const sourceSettings = sourceSettingsForms[source.id];

    if (!sourceSettings) {
      setFeedback("Failed to update source.");
      return;
    }

    setFeedback(null);
    markSourceUpdating(source.id);

    const result = await updateSource(source.id, {
      fetchMethod: sourceSettings.fetchMethod,
      pollIntervalMinutes: Number(sourceSettings.pollIntervalMinutes),
    });

    clearSourceUpdating(source.id);

    if (result.error || !result.source) {
      setFeedback("Failed to update source.");
      return;
    }

    applyUpdatedSource(result.source);
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
      fetchMethod: createSourceForm.fetchMethod as SourceFetchMethod,
      trustScore: Number(createSourceForm.trustScore),
      pollIntervalMinutes: Number(createSourceForm.pollIntervalMinutes),
    });

    setIsCreating(false);

    if (result.error || !result.source) {
      setFeedback("Failed to create source.");
      return;
    }

    setSources((currentSources) => [result.source!, ...currentSources]);
    setSourceSettingsForms((currentForms) => ({
      [result.source!.id]: buildSourceSettingsForm(result.source!),
      ...currentForms,
    }));
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
          <label htmlFor="source-fetch-method">Fetch method</label>
          <select
            id="source-fetch-method"
            name="fetchMethod"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                fetchMethod: event.target.value as SourceFetchMethod | "",
              }));
            }}
            required
            value={createSourceForm.fetchMethod}
          >
            <option value="">Select fetch method</option>
            {sourceFetchMethods.map((fetchMethod) => (
              <option key={fetchMethod} value={fetchMethod}>
                {fetchMethod}
              </option>
            ))}
          </select>
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
        <div>
          <label htmlFor="source-poll-interval">Poll interval (minutes)</label>
          <input
            id="source-poll-interval"
            min="1"
            name="pollIntervalMinutes"
            onChange={(event) => {
              setCreateSourceForm((currentForm) => ({
                ...currentForm,
                pollIntervalMinutes: event.target.value,
              }));
            }}
            required
            step="1"
            type="number"
            value={createSourceForm.pollIntervalMinutes}
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
              <th>Fetch method</th>
              <th>Poll interval</th>
              <th>Trust score</th>
              <th>Language</th>
              <th>Last poll</th>
              <th>Last lead</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const sourceSettings = sourceSettingsForms[source.id] ?? buildSourceSettingsForm(source);
              const isUpdating = updatingSourceIds.includes(source.id);

              return (
                <tr key={source.id}>
                  <td>{source.name}</td>
                  <td>{source.sourceType}</td>
                  <td>{source.baseUrl}</td>
                  <td>
                    <select
                      aria-label={`Fetch method for ${source.name}`}
                      disabled={isUpdating}
                      onChange={(event) => {
                        setSourceSettingsForms((currentForms) => ({
                          ...currentForms,
                          [source.id]: {
                            ...sourceSettings,
                            fetchMethod: event.target.value as SourceFetchMethod,
                          },
                        }));
                      }}
                      value={sourceSettings.fetchMethod}
                    >
                      {sourceFetchMethods.map((fetchMethod) => (
                        <option key={fetchMethod} value={fetchMethod}>
                          {fetchMethod}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Poll interval (minutes) for ${source.name}`}
                      disabled={isUpdating}
                      min="1"
                      onChange={(event) => {
                        setSourceSettingsForms((currentForms) => ({
                          ...currentForms,
                          [source.id]: {
                            ...sourceSettings,
                            pollIntervalMinutes: event.target.value,
                          },
                        }));
                      }}
                      step="1"
                      type="number"
                      value={sourceSettings.pollIntervalMinutes}
                    />{" "}
                    <button
                      disabled={isUpdating}
                      onClick={() => {
                        void handleSaveSettings(source);
                      }}
                      type="button"
                    >
                      Save settings
                    </button>
                  </td>
                  <td>{source.trustScore}</td>
                  <td>{source.language}</td>
                  <td>{getPollSummary(source)}</td>
                  <td>{source.lastLeadCreatedAt ?? "No leads yet"}</td>
                  <td>
                    {source.enabled ? "Enabled" : "Disabled"}{" "}
                    <button
                      disabled={isUpdating}
                      onClick={() => {
                        void handleToggle(source);
                      }}
                      type="button"
                    >
                      {source.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
