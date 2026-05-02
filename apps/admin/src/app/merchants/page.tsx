"use client";

import React, { useEffect, useState } from "react";
import {
  appendSortedRowByName,
  replaceSortedRowByName,
  sortRowsByName,
} from "../../lib/catalogRowOrdering";

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

interface MerchantUpdateResult {
  merchant: MerchantRow | null;
  error: string | null;
}

interface MerchantDeleteResult {
  error: string | null;
}

interface CreateMerchantFormState {
  name: string;
}

interface EditMerchantFormState {
  name: string;
  primaryCategory: string;
  status: string;
  owner: string;
}

const emptyCreateMerchantForm: CreateMerchantFormState = {
  name: "",
};

const emptyEditMerchantForm: EditMerchantFormState = {
  name: "",
  primaryCategory: "",
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
    const response = await fetch("/v1/admin/merchants", {
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
    const response = await fetch("/v1/admin/merchants", {
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

async function updateMerchant(
  merchantId: string,
  input: EditMerchantFormState,
): Promise<MerchantUpdateResult> {
  try {
    const response = await fetch(`/v1/admin/merchants/${merchantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        merchant: null,
        error: await readResponseMessage(response, "Failed to update merchant."),
      };
    }

    const merchant = normalizeMerchantRow(await response.json());

    if (!merchant) {
      return {
        merchant: null,
        error: "Failed to update merchant.",
      };
    }

    return {
      merchant,
      error: null,
    };
  } catch {
    return {
      merchant: null,
      error: "Failed to update merchant.",
    };
  }
}

async function deleteMerchant(merchantId: string): Promise<MerchantDeleteResult> {
  try {
    const response = await fetch(`/v1/admin/merchants/${merchantId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        error: await readResponseMessage(response, "Failed to delete merchant."),
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to delete merchant.",
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
  const [editMerchantForm, setEditMerchantForm] =
    useState<EditMerchantFormState>(emptyEditMerchantForm);
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingMerchantId, setIsSavingMerchantId] = useState<string | null>(null);
  const [isDeletingMerchantId, setIsDeletingMerchantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      const result = await listMerchants();

      if (cancelled) {
        return;
      }

      setMerchants(sortRowsByName(result.items));
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

    setMerchants((currentMerchants) => appendSortedRowByName(currentMerchants, merchant));
    setError(null);
    setCreateMerchantForm(emptyCreateMerchantForm);
    setFeedback("Merchant created.");
  }

  function startEditingMerchant(merchant: MerchantRow) {
    setFeedback(null);
    setEditingMerchantId(merchant.id);
    setEditMerchantForm({
      name: merchant.name,
      primaryCategory: merchant.primaryCategory,
      status: merchant.status,
      owner: merchant.owner,
    });
  }

  function stopEditingMerchant() {
    setEditingMerchantId(null);
    setEditMerchantForm(emptyEditMerchantForm);
  }

  async function handleSaveMerchant(merchantId: string) {
    setFeedback(null);
    setIsSavingMerchantId(merchantId);

    const result = await updateMerchant(merchantId, {
      name: editMerchantForm.name.trim(),
      primaryCategory: editMerchantForm.primaryCategory.trim(),
      status: editMerchantForm.status.trim(),
      owner: editMerchantForm.owner.trim(),
    });

    setIsSavingMerchantId(null);

    if (result.error || !result.merchant) {
      setFeedback(result.error ?? "Failed to update merchant.");
      return;
    }

    setMerchants((currentMerchants) =>
      replaceSortedRowByName(currentMerchants, result.merchant!),
    );
    setError(null);
    stopEditingMerchant();
    setFeedback("Merchant updated.");
  }

  async function handleDeleteMerchant(merchantId: string) {
    setFeedback(null);
    setIsDeletingMerchantId(merchantId);

    const result = await deleteMerchant(merchantId);

    setIsDeletingMerchantId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    setMerchants((currentMerchants) =>
      currentMerchants.filter((merchant) => merchant.id !== merchantId),
    );

    if (editingMerchantId === merchantId) {
      stopEditingMerchant();
    }

    setFeedback("Merchant deleted.");
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((merchant) => {
              const isEditing = merchant.id === editingMerchantId;
              const isSaving = merchant.id === isSavingMerchantId;
              const isDeleting = merchant.id === isDeletingMerchantId;

              return (
                <tr key={merchant.id}>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Merchant name"
                        onChange={(event) => {
                          setEditMerchantForm((currentForm) => ({
                            ...currentForm,
                            name: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editMerchantForm.name}
                      />
                    ) : (
                      merchant.name
                    )}
                  </td>
                  <td>{merchant.activeDeals}</td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Primary category"
                        onChange={(event) => {
                          setEditMerchantForm((currentForm) => ({
                            ...currentForm,
                            primaryCategory: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editMerchantForm.primaryCategory}
                      />
                    ) : (
                      merchant.primaryCategory
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Status"
                        onChange={(event) => {
                          setEditMerchantForm((currentForm) => ({
                            ...currentForm,
                            status: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editMerchantForm.status}
                      />
                    ) : (
                      merchant.status
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Owner"
                        onChange={(event) => {
                          setEditMerchantForm((currentForm) => ({
                            ...currentForm,
                            owner: event.target.value,
                          }));
                        }}
                        required
                        type="text"
                        value={editMerchantForm.owner}
                      />
                    ) : (
                      merchant.owner
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <>
                        <button
                          disabled={isSaving}
                          onClick={() => {
                            void handleSaveMerchant(merchant.id);
                          }}
                          type="button"
                        >
                          {isSaving ? "Saving merchant..." : "Save merchant"}
                        </button>
                        <button
                          disabled={isSaving}
                          onClick={stopEditingMerchant}
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
                            startEditingMerchant(merchant);
                          }}
                          type="button"
                        >
                          Edit merchant
                        </button>
                        <button
                          disabled={isDeleting}
                          onClick={() => {
                            void handleDeleteMerchant(merchant.id);
                          }}
                          type="button"
                        >
                          {isDeleting ? "Deleting merchant..." : "Delete merchant"}
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
