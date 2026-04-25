import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SnapshotsPage from "../app/snapshots/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("snapshots page", () => {
  it("loads snapshots for a deal slug", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        dealSlug: "airpods-pro-2-costco-au",
        snapshots: [
          {
            label: "Warehouse weekend",
            merchant: "Costco AU",
            observedAt: "2025-04-01T00:00:00.000Z",
            price: "299.00",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SnapshotsPage />);

    await user.type(screen.getByLabelText("Deal slug"), "airpods-pro-2-costco-au");
    await user.click(screen.getByRole("button", { name: "Load snapshots" }));

    expect(fetchMock).toHaveBeenCalledWith("/v1/admin/price-snapshots/airpods-pro-2-costco-au", {
      cache: "no-store",
    });
    expect((await screen.findByLabelText("Label 1") as HTMLInputElement).value).toBe("Warehouse weekend");
    expect((screen.getByLabelText("Merchant 1") as HTMLInputElement).value).toBe("Costco AU");
  });

  it("saves edited snapshots for a deal slug", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          dealSlug: "airpods-pro-2-costco-au",
          snapshots: [],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          dealSlug: "airpods-pro-2-costco-au",
          snapshots: [
            {
              label: "Warehouse weekend",
              merchant: "Costco AU",
              observedAt: "2025-04-01T00:00:00.000Z",
              price: "299.00",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SnapshotsPage />);

    await user.type(screen.getByLabelText("Deal slug"), "airpods-pro-2-costco-au");
    await user.click(screen.getByRole("button", { name: "Load snapshots" }));
    await user.click(screen.getByRole("button", { name: "Add snapshot" }));
    await user.type(screen.getByLabelText("Label 1"), "Warehouse weekend");
    await user.type(screen.getByLabelText("Merchant 1"), "Costco AU");
    await user.type(screen.getByLabelText("Observed at 1"), "2025-04-01T00:00:00.000Z");
    await user.type(screen.getByLabelText("Price 1"), "299.00");
    await waitFor(() => {
      expect((screen.getByLabelText("Label 1") as HTMLInputElement).value).toBe(
        "Warehouse weekend",
      );
      expect((screen.getByLabelText("Merchant 1") as HTMLInputElement).value).toBe("Costco AU");
      expect((screen.getByLabelText("Observed at 1") as HTMLInputElement).value).toBe(
        "2025-04-01T00:00:00.000Z",
      );
      expect((screen.getByLabelText("Price 1") as HTMLInputElement).value).toBe("299.00");
    });
    await user.click(screen.getByRole("button", { name: "Save snapshots" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/v1/admin/price-snapshots/airpods-pro-2-costco-au",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshots: [
            {
              label: "Warehouse weekend",
              merchant: "Costco AU",
              observedAt: "2025-04-01T00:00:00.000Z",
              price: "299.00",
            },
          ],
        }),
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Snapshots saved.")).toBeTruthy();
    });
  });
});
