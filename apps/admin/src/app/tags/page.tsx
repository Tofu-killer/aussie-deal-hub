"use client";

import React, { useEffect, useState } from "react";

interface TagRow {
  id: string;
  name: string;
  slug: string;
  visibleDeals: number;
  localization: string;
  owner: string;
}

interface TagLoadResult {
  items: TagRow[];
  error: string | null;
}

interface TagCreateResult {
  tag: TagRow | null;
  error: string | null;
}

interface CreateTagFormState {
  name: string;
}

const emptyCreateTagForm: CreateTagFormState = {
  name: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function normalizeTagRow(value: unknown): TagRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    name: readString(value.name),
    slug: readString(value.slug),
    visibleDeals: readNumber(value.visibleDeals),
    localization: readString(value.localization),
    owner: readString(value.owner),
  };
}

function extractTagItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (Array.isArray(body.tags)) {
    return body.tags;
  }

  return [];
}

async function listTags(): Promise<TagLoadResult> {
  try {
    const response = await fetch("/v1/admin/tags", {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load tags.",
      };
    }

    return {
      items: extractTagItems(await response.json())
        .map((item) => normalizeTagRow(item))
        .filter((item): item is TagRow => item !== null),
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load tags.",
    };
  }
}

async function createTag(name: string): Promise<TagCreateResult> {
  try {
    const response = await fetch("/v1/admin/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      return {
        tag: null,
        error: "Failed to create tag.",
      };
    }

    const tag = normalizeTagRow(await response.json());

    if (!tag) {
      return {
        tag: null,
        error: "Failed to create tag.",
      };
    }

    return {
      tag,
      error: null,
    };
  } catch {
    return {
      tag: null,
      error: "Failed to create tag.",
    };
  }
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createTagForm, setCreateTagForm] = useState<CreateTagFormState>(emptyCreateTagForm);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      const result = await listTags();

      if (cancelled) {
        return;
      }

      setTags(result.items);
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateTagSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsCreating(true);

    const result = await createTag(createTagForm.name.trim());

    setIsCreating(false);

    if (result.error || !result.tag) {
      setFeedback("Failed to create tag.");
      return;
    }

    const { tag } = result;

    setTags((currentTags) => [tag, ...currentTags]);
    setError(null);
    setCreateTagForm(emptyCreateTagForm);
    setFeedback("Tag created.");
  }

  return (
    <main>
      <h1>Tags</h1>
      <p>Audit public tagging before merchandising changes.</p>
      <form
        onSubmit={(event) => {
          void handleCreateTagSubmit(event);
        }}
      >
        <div>
          <label htmlFor="tag-name">Tag name</label>
          <input
            id="tag-name"
            name="name"
            onChange={(event) => {
              setCreateTagForm({
                name: event.target.value,
              });
            }}
            required
            type="text"
            value={createTagForm.name}
          />
        </div>
        <button disabled={isCreating} type="submit">
          {isCreating ? "Creating tag..." : "Create tag"}
        </button>
      </form>
      {feedback ? <p>{feedback}</p> : null}
      {error ? (
        <p>{error}</p>
      ) : isLoading ? (
        <p>Loading tags...</p>
      ) : tags.length === 0 ? (
        <p>No tags available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Slug</th>
              <th>Visible deals</th>
              <th>Localization</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td>{tag.name}</td>
                <td>{tag.slug}</td>
                <td>{tag.visibleDeals}</td>
                <td>{tag.localization}</td>
                <td>{tag.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
