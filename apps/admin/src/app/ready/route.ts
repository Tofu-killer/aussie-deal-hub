import { buildAdminApiUrl, isAdminApiConfigurationError } from "../../lib/runtimeApi";

export const dynamic = "force-dynamic";

interface ReadyPayload {
  ok: boolean;
  dependencies?: Record<string, string>;
}

function buildReadyUrl() {
  return buildAdminApiUrl("/v1/ready");
}

function isReadyPayload(payload: unknown): payload is ReadyPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    typeof (payload as { ok?: unknown }).ok === "boolean"
  );
}

async function buildReadyResponse(response: Response) {
  try {
    const payload = await response.json();

    if (isReadyPayload(payload)) {
      return Response.json(payload, {
        status: payload.ok ? 200 : 503,
      });
    }
  } catch {}

  return Response.json(
    { ok: response.ok },
    {
      status: response.ok ? 200 : 503,
    },
  );
}

export async function GET() {
  try {
    const response = await fetch(buildReadyUrl(), {
      cache: "no-store",
    });

    return await buildReadyResponse(response);
  } catch (error) {
    if (isAdminApiConfigurationError(error)) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 503 },
      );
    }

    return Response.json({ ok: false }, { status: 503 });
  }
}
