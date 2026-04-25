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

interface CreateTopicFormState {
  name: string;
}

const emptyCreateTopicForm: CreateTopicFormState = {
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

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createTopicForm, setCreateTopicForm] = useState<CreateTopicFormState>(emptyCreateTopicForm);
  const [isCreating, setIsCreating] = useState(false);

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
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.name}</td>
                <td>{topic.slug}</td>
                <td>{topic.spotlightDeals}</td>
                <td>{topic.status}</td>
                <td>{topic.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
