export const SESSION_COOKIE_NAME = "aussie_deal_hub_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface SessionCookieOverrides {
  expires?: Date;
  maxAge?: number;
}

function shouldUseSecureSessionCookie() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";

  return siteUrl.startsWith("https://");
}

export function getSessionCookieOptions(overrides: SessionCookieOverrides = {}) {
  return {
    ...overrides,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: shouldUseSecureSessionCookie(),
  };
}

export async function resolveSessionTokens() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    return {
      sessionToken,
    };
  } catch {
    return {
      sessionToken: undefined,
    };
  }
}

export async function persistSessionTokenCookie(sessionToken: string) {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    sessionToken,
    getSessionCookieOptions({
      maxAge: SESSION_COOKIE_MAX_AGE,
    }),
  );
}

export async function clearSessionTokenCookie() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    "",
    getSessionCookieOptions({
      expires: new Date(0),
    }),
  );
}
