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

interface TagUpdateResult {
  tag: TagRow | null;
  error: string | null;
}

interface TagDeleteResult {
  error: string | null;
}

interface CreateTagFormState {
  name: string;
}

interface EditTagFormState {
  name: string;
  slug: string;
  localization: string;
  owner: string;
}

const emptyCreateTagForm: CreateTagFormState = {
  name: "",
};

const emptyEditTagForm: EditTagFormState = {
  name: "",
  slug: "",
  localization: "",
  owner: "",
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

async function readResponseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();

    if (isRecord(body)) {
      const message = readString(body.message).trim();

      if (message) {
        return message;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
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

async function updateTag(tagId: string, input: EditTagFormState): Promise<TagUpdateResult> {
  try {
    const response = await fetch(`/v1/admin/tags/${tagId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        tag: null,
        error: await readResponseMessage(response, "Failed to update tag."),
      };
    }

    const tag = normalizeTagRow(await response.json());

    if (!tag) {
      return {
        tag: null,
        error: "Failed to update tag.",
      };
    }

    return {
      tag,
      error: null,
    };
  } catch {
    return {
      tag: null,
      error: "Failed to update tag.",
    };
  }
}

async function deleteTag(tagId: string): Promise<TagDeleteResult> {
  try {
    const response = await fetch(`/v1/admin/tags/${tagId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        error: await readResponseMessage(response, "Failed to delete tag."),
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to delete tag.",
    };
  }
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createTagForm, setCreateTagForm] = useState<CreateTagFormState>(emptyCreateTagForm);
  const [editTagForm, setEditTagForm] = useState<EditTagFormState>(emptyEditTagForm);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingTagId, setIsSavingTagId] = useState<string | null>(null);
  const [isDeletingTagId, setIsDeletingTagId] = useState<string | null>(null);

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

  function startEditingTag(tag: TagRow) {
    setFeedback(null);
    setEditingTagId(tag.id);
    setEditTagForm({
      name: tag.name,
      slug: tag.slug,
      localization: tag.localization,
      owner: tag.owner,
    });
  }

  function stopEditingTag() {
    setEditingTagId(null);
    setEditTagForm(emptyEditTagForm);
  }

  async function handleSaveTag(tagId: string) {
    setFeedback(null);
    setIsSavingTagId(tagId);

    const result = await updateTag(tagId, {
      name: editTagForm.name.trim(),
      slug: editTagForm.slug.trim(),
      localization: editTagForm.localization.trim(),
      owner: editTagForm.owner.trim(),
    });

    setIsSavingTagId(null);

    if (result.error || !result.tag) {
      setFeedback(result.error ?? "Failed to update tag.");
      return;
    }

    setTags((currentTags) => currentTags.map((tag) => (tag.id === tagId ? result.tag! : tag)));
    setError(null);
    stopEditingTag();
    setFeedback("Tag updated.");
  }

  async function handleDeleteTag(tagId: string) {
    setFeedback(null);
    setIsDeletingTagId(tagId);

    const result = await deleteTag(tagId);

    setIsDeletingTagId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    setTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));

    if (editingTagId === tagId) {
      stopEditingTag();
    }

    setFeedback("Tag deleted.");
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => {
              const isEditing = tag.id === editingTagId;
              const isSaving = tag.id === isSavingTagId;
              const isDeleting = tag.id === isDeletingTagId;

              return (
                <tr key={tag.id}>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Tag name"
                        onChange={(event) => {
                          setEditTagForm((currentForm) => ({
                            ...currentForm,
                            name: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTagForm.name}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Slug"
                        onChange={(event) => {
                          setEditTagForm((currentForm) => ({
                            ...currentForm,
                            slug: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTagForm.slug}
                      />
                    ) : (
                      tag.slug
                    )}
                  </td>
                  <td>{tag.visibleDeals}</td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Localization"
                        onChange={(event) => {
                          setEditTagForm((currentForm) => ({
                            ...currentForm,
                            localization: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTagForm.localization}
                      />
                    ) : (
                      tag.localization
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Owner"
                        onChange={(event) => {
                          setEditTagForm((currentForm) => ({
                            ...currentForm,
                            owner: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTagForm.owner}
                      />
                    ) : (
                      tag.owner
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <>
                        <button
                          disabled={isSaving}
                          onClick={() => {
                            void handleSaveTag(tag.id);
                          }}
                          type="button"
                        >
                          {isSaving ? "Saving tag..." : "Save tag"}
                        </button>
                        <button
                          disabled={isSaving}
                          onClick={stopEditingTag}
                          type="button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={isDeleting}
                          onClick={() => {
                            startEditingTag(tag);
                          }}
                          type="button"
                        >
                          Edit tag
                        </button>
                        <button
                          disabled={isDeleting}
                          onClick={() => {
                            void handleDeleteTag(tag.id);
                          }}
                          type="button"
                        >
                          {isDeleting ? "Deleting tag..." : "Delete tag"}
                        </button>
                      </>
                    )}
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
