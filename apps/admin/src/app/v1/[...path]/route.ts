export const dynamic = "force-dynamic";

const DEFAULT_ADMIN_API_BASE_URL = "http://127.0.0.1:3001";

function getAdminApiBaseUrl() {
  return (process.env.ADMIN_API_BASE_URL ?? DEFAULT_ADMIN_API_BASE_URL).replace(/\/+$/, "");
}

function buildProxyUrl(request: Request, path: string[]) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${getAdminApiBaseUrl()}/v1/${path.join("/")}`);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl.toString();
}

async function forwardRequest(
  request: Request,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  try {
    const { path } = await context.params;
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.text() : undefined;
    const upstream = await fetch(buildProxyUrl(request, path), {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      cache: "no-store",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch {
    return Response.json({ message: "Admin API unavailable." }, { status: 503 });
  }
}

export const GET = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
