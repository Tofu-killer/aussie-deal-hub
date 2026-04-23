export const dynamic = "force-dynamic";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

function buildReadyUrl() {
  const apiBaseUrl = (process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  return `${apiBaseUrl}/v1/ready`;
}

export async function GET() {
  try {
    const response = await fetch(buildReadyUrl(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ ok: false }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
