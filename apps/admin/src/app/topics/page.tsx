"use client";

import React, { useEffect, useState } from "react";

interface TopicRow {
  id: string;
  name: string;
  slug: string;
  spotlightDeals: number;
  status: string;
  owner: string;
}

interface TopicLoadResult {
  items: TopicRow[];
  error: string | null;
}

interface TopicCreateResult {
  topic: TopicRow | null;
  error: string | null;
}

interface TopicUpdateResult {
  topic: TopicRow | null;
  error: string | null;
}

interface TopicDeleteResult {
  error: string | null;
}

interface CreateTopicFormState {
  name: string;
}

interface EditTopicFormState {
  name: string;
  slug: string;
  status: string;
  owner: string;
}

const emptyCreateTopicForm: CreateTopicFormState = {
  name: "",
};

const emptyEditTopicForm: EditTopicFormState = {
  name: "",
  slug: "",
  status: "",
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

function normalizeTopicRow(value: unknown): TopicRow | null {
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
    spotlightDeals: readNumber(value.spotlightDeals),
    status: readString(value.status),
    owner: readString(value.owner),
  };
}

function extractTopicItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (Array.isArray(body.topics)) {
    return body.topics;
  }

  return [];
}

async function listTopics(): Promise<TopicLoadResult> {
  try {
    const response = await fetch("/v1/admin/topics", {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load topics.",
      };
    }

    return {
      items: extractTopicItems(await response.json())
        .map((item) => normalizeTopicRow(item))
        .filter((item): item is TopicRow => item !== null),
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load topics.",
    };
  }
}

async function createTopic(name: string): Promise<TopicCreateResult> {
  try {
    const response = await fetch("/v1/admin/topics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      return {
        topic: null,
        error: "Failed to create topic.",
      };
    }

    const topic = normalizeTopicRow(await response.json());

    if (!topic) {
      return {
        topic: null,
        error: "Failed to create topic.",
      };
    }

    return {
      topic,
      error: null,
    };
  } catch {
    return {
      topic: null,
      error: "Failed to create topic.",
    };
  }
}

async function updateTopic(
  topicId: string,
  input: EditTopicFormState,
): Promise<TopicUpdateResult> {
  try {
    const response = await fetch(`/v1/admin/topics/${topicId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        topic: null,
        error: await readResponseMessage(response, "Failed to update topic."),
      };
    }

    const topic = normalizeTopicRow(await response.json());

    if (!topic) {
      return {
        topic: null,
        error: "Failed to update topic.",
      };
    }

    return {
      topic,
      error: null,
    };
  } catch {
    return {
      topic: null,
      error: "Failed to update topic.",
    };
  }
}

async function deleteTopic(topicId: string): Promise<TopicDeleteResult> {
  try {
    const response = await fetch(`/v1/admin/topics/${topicId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        error: await readResponseMessage(response, "Failed to delete topic."),
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to delete topic.",
    };
  }
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createTopicForm, setCreateTopicForm] = useState<CreateTopicFormState>(emptyCreateTopicForm);
  const [editTopicForm, setEditTopicForm] = useState<EditTopicFormState>(emptyEditTopicForm);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingTopicId, setIsSavingTopicId] = useState<string | null>(null);
  const [isDeletingTopicId, setIsDeletingTopicId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      const result = await listTopics();

      if (cancelled) {
        return;
      }

      setTopics(result.items);
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateTopicSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsCreating(true);

    const result = await createTopic(createTopicForm.name.trim());

    setIsCreating(false);

    if (result.error || !result.topic) {
      setFeedback("Failed to create topic.");
      return;
    }

    setTopics((currentTopics) => [result.topic, ...currentTopics]);
    setError(null);
    setCreateTopicForm(emptyCreateTopicForm);
    setFeedback("Topic created.");
  }

  function startEditingTopic(topic: TopicRow) {
    setFeedback(null);
    setEditingTopicId(topic.id);
    setEditTopicForm({
      name: topic.name,
      slug: topic.slug,
      status: topic.status,
      owner: topic.owner,
    });
  }

  function stopEditingTopic() {
    setEditingTopicId(null);
    setEditTopicForm(emptyEditTopicForm);
  }

  async function handleSaveTopic(topicId: string) {
    setFeedback(null);
    setIsSavingTopicId(topicId);

    const result = await updateTopic(topicId, {
      name: editTopicForm.name.trim(),
      slug: editTopicForm.slug.trim(),
      status: editTopicForm.status.trim(),
      owner: editTopicForm.owner.trim(),
    });

    setIsSavingTopicId(null);

    if (result.error || !result.topic) {
      setFeedback(result.error ?? "Failed to update topic.");
      return;
    }

    setTopics((currentTopics) =>
      currentTopics.map((topic) => (topic.id === topicId ? result.topic! : topic)),
    );
    setError(null);
    stopEditingTopic();
    setFeedback("Topic updated.");
  }

  async function handleDeleteTopic(topicId: string) {
    setFeedback(null);
    setIsDeletingTopicId(topicId);

    const result = await deleteTopic(topicId);

    setIsDeletingTopicId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    setTopics((currentTopics) => currentTopics.filter((topic) => topic.id !== topicId));

    if (editingTopicId === topicId) {
      stopEditingTopic();
    }

    setFeedback("Topic deleted.");
  }

  return (
    <main>
      <h1>Topics</h1>
      <p>Review editorial topics that group themed deal coverage.</p>
      <form
        onSubmit={(event) => {
          void handleCreateTopicSubmit(event);
        }}
      >
        <div>
          <label htmlFor="topic-name">Topic name</label>
          <input
            id="topic-name"
            name="name"
            onChange={(event) => {
              setCreateTopicForm({
                name: event.target.value,
              });
            }}
            required
            type="text"
            value={createTopicForm.name}
          />
        </div>
        <button disabled={isCreating} type="submit">
          {isCreating ? "Creating topic..." : "Create topic"}
        </button>
      </form>
      {feedback ? <p>{feedback}</p> : null}
      {error ? (
        <p>{error}</p>
      ) : isLoading ? (
        <p>Loading topics...</p>
      ) : topics.length === 0 ? (
        <p>No topics available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Slug</th>
              <th>Spotlight deals</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => {
              const isEditing = topic.id === editingTopicId;
              const isSaving = topic.id === isSavingTopicId;
              const isDeleting = topic.id === isDeletingTopicId;

              return (
                <tr key={topic.id}>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Topic name"
                        onChange={(event) => {
                          setEditTopicForm((currentForm) => ({
                            ...currentForm,
                            name: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTopicForm.name}
                      />
                    ) : (
                      topic.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Slug"
                        onChange={(event) => {
                          setEditTopicForm((currentForm) => ({
                            ...currentForm,
                            slug: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTopicForm.slug}
                      />
                    ) : (
                      topic.slug
                    )}
                  </td>
                  <td>{topic.spotlightDeals}</td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Status"
                        onChange={(event) => {
                          setEditTopicForm((currentForm) => ({
                            ...currentForm,
                            status: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTopicForm.status}
                      />
                    ) : (
                      topic.status
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Owner"
                        onChange={(event) => {
                          setEditTopicForm((currentForm) => ({
                            ...currentForm,
                            owner: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editTopicForm.owner}
                      />
                    ) : (
                      topic.owner
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <>
                        <button
                          disabled={isSaving}
                          onClick={() => {
                            void handleSaveTopic(topic.id);
                          }}
                          type="button"
                        >
                          {isSaving ? "Saving topic..." : "Save topic"}
                        </button>
                        <button
                          disabled={isSaving}
                          onClick={stopEditingTopic}
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
                            startEditingTopic(topic);
                          }}
                          type="button"
                        >
                          Edit topic
                        </button>
                        <button
                          disabled={isDeleting}
                          onClick={() => {
                            void handleDeleteTopic(topic.id);
                          }}
                          type="button"
                        >
                          {isDeleting ? "Deleting topic..." : "Delete topic"}
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
