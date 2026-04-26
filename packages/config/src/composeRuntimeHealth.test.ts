import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const modulePath = path.join(import.meta.dirname, "composeRuntimeHealth.ts");

describe("compose runtime health", () => {
  it("treats required running and healthy services as healthy", async () => {
    expect(existsSync(modulePath)).toBe(true);

    if (!existsSync(modulePath)) {
      return;
    }

    const { evaluateComposeRuntimeHealth, parseComposePsOutput } = await import(
      "./composeRuntimeHealth.ts"
    );

    const result = evaluateComposeRuntimeHealth(
      parseComposePsOutput(
        JSON.stringify([
          { Service: "api", State: "running", Health: "healthy" },
          { Service: "web", State: "running", Health: "healthy" },
          { Service: "admin", State: "running", Health: "healthy" },
          { Service: "worker", State: "running", Health: "healthy" },
        ]),
      ),
      ["api", "web", "admin", "worker"],
    );

    expect(result).toEqual({
      ok: true,
      pendingServices: [],
    });
  });

  it("reports missing or not-yet-healthy required services", async () => {
    expect(existsSync(modulePath)).toBe(true);

    if (!existsSync(modulePath)) {
      return;
    }

    const { evaluateComposeRuntimeHealth, parseComposePsOutput } = await import(
      "./composeRuntimeHealth.ts"
    );

    const result = evaluateComposeRuntimeHealth(
      parseComposePsOutput(
        JSON.stringify([
          { Service: "api", State: "running", Health: "healthy" },
          { Service: "web", State: "running", Health: "starting" },
          { Service: "worker", State: "exited", Health: "" },
        ]),
      ),
      ["api", "web", "admin", "worker"],
    );

    expect(result).toEqual({
      ok: false,
      pendingServices: [
        { service: "web", state: "running", health: "starting" },
        { service: "admin", state: "missing", health: null },
        { service: "worker", state: "exited", health: null },
      ],
    });
  });

  it("parses newline-delimited compose ps rows", async () => {
    expect(existsSync(modulePath)).toBe(true);

    if (!existsSync(modulePath)) {
      return;
    }

    const { parseComposePsOutput } = await import("./composeRuntimeHealth.ts");

    expect(
      parseComposePsOutput(
        [
          JSON.stringify({ Service: "api", State: "running", Health: "healthy" }),
          JSON.stringify({ Service: "worker", State: "running", Health: "starting" }),
        ].join("\n"),
      ),
    ).toEqual([
      { service: "api", state: "running", health: "healthy" },
      { service: "worker", state: "running", health: "starting" },
    ]);
  });

  it("treats required services without a health status as pending", async () => {
    expect(existsSync(modulePath)).toBe(true);

    if (!existsSync(modulePath)) {
      return;
    }

    const { evaluateComposeRuntimeHealth, parseComposePsOutput } = await import(
      "./composeRuntimeHealth.ts"
    );

    expect(
      evaluateComposeRuntimeHealth(
        parseComposePsOutput(
          JSON.stringify([
            { Service: "api", State: "running", Health: "healthy" },
            { Service: "web", State: "running", Health: "" },
            { Service: "admin", State: "running", Health: "healthy" },
            { Service: "worker", State: "running", Health: "healthy" },
          ]),
        ),
        ["api", "web", "admin", "worker"],
      ),
    ).toEqual({
      ok: false,
      pendingServices: [{ service: "web", state: "running", health: null }],
    });
  });
});
