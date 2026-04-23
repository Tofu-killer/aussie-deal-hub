"use client";

import React, { useEffect, useState } from "react";

interface MerchantRow {
  id: string;
  name: string;
  activeDeals: number;
  primaryCategory: string;
  status: string;
  owner: string;
}

interface MerchantLoadResult {
  items: MerchantRow[];
  error: string | null;
}

interface MerchantCreateResult {
  merchant: MerchantRow | null;
  error: string | null;
}

interface CreateMerchantFormState {
  name: string;
}

const emptyCreateMerchantForm: CreateMerchantFormState = {
  name: "",
};

function getAdminApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function normalizeMerchantRow(value: unknown): MerchantRow | null {
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
    activeDeals: readNumber(value.activeDeals),
    primaryCategory: readString(value.primaryCategory),
    status: readString(value.status),
    owner: readString(value.owner),
  };
}

function extractMerchantItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (Array.isArray(body.merchants)) {
    return body.merchants;
  }

  return [];
}

async function listMerchants(): Promise<MerchantLoadResult> {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/v1/admin/merchants`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load merchants.",
      };
    }

    return {
      items: extractMerchantItems(await response.json())
        .map((item) => normalizeMerchantRow(item))
        .filter((item): item is MerchantRow => item !== null),
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load merchants.",
    };
  }
}

async function createMerchant(name: string): Promise<MerchantCreateResult> {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/v1/admin/merchants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      return {
        merchant: null,
        error: "Failed to create merchant.",
      };
    }

    const merchant = normalizeMerchantRow(await response.json());

    if (!merchant) {
      return {
        merchant: null,
        error: "Failed to create merchant.",
      };
    }

    return {
      merchant,
      error: null,
    };
  } catch {
    return {
      merchant: null,
      error: "Failed to create merchant.",
    };
  }
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createMerchantForm, setCreateMerchantForm] =
    useState<CreateMerchantFormState>(emptyCreateMerchantForm);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      const result = await listMerchants();

      if (cancelled) {
        return;
      }

      setMerchants(result.items);
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateMerchantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsCreating(true);

    const result = await createMerchant(createMerchantForm.name.trim());

    setIsCreating(false);

    if (result.error || !result.merchant) {
      setFeedback("Failed to create merchant.");
      return;
    }

    const { merchant } = result;

    setMerchants((currentMerchants) => [merchant, ...currentMerchants]);
    setError(null);
    setCreateMerchantForm(emptyCreateMerchantForm);
    setFeedback("Merchant created.");
  }

  return (
    <main>
      <h1>Merchants</h1>
      <p>Review merchant health before publishing deals.</p>
      <form
        onSubmit={(event) => {
          void handleCreateMerchantSubmit(event);
        }}
      >
        <div>
          <label htmlFor="merchant-name">Merchant name</label>
          <input
            id="merchant-name"
            name="name"
            onChange={(event) => {
              setCreateMerchantForm({
                name: event.target.value,
              });
            }}
            required
            type="text"
            value={createMerchantForm.name}
          />
        </div>
        <button disabled={isCreating} type="submit">
          {isCreating ? "Creating merchant..." : "Create merchant"}
        </button>
      </form>
      {feedback ? <p>{feedback}</p> : null}
      {error ? (
        <p>{error}</p>
      ) : isLoading ? (
        <p>Loading merchants...</p>
      ) : merchants.length === 0 ? (
        <p>No merchants available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Active deals</th>
              <th>Primary category</th>
              <th>Status</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((merchant) => (
              <tr key={merchant.id}>
                <td>{merchant.name}</td>
                <td>{merchant.activeDeals}</td>
                <td>{merchant.primaryCategory}</td>
                <td>{merchant.status}</td>
                <td>{merchant.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
