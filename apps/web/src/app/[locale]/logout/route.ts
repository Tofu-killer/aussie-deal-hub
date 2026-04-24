import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "../../../lib/session";

interface LogoutRouteContext {
  params: Promise<{
    locale: string;
  }>;
}

function shouldUseSecureSessionCookie() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";

  return siteUrl.startsWith("https://");
}

export async function GET(request: Request, context: LogoutRouteContext) {
  const { locale } = await context.params;
  const response = NextResponse.redirect(new URL(`/${locale}`, request.url));

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
  });

  return response;
}
