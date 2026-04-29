import { NextResponse } from "next/server";

import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "../../../lib/session";

interface LogoutRouteContext {
  params: Promise<{
    locale: string;
  }>;
}

function getLogoutRedirectBaseUrl(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;

  return configuredSiteUrl && configuredSiteUrl.length > 0 ? configuredSiteUrl : request.url;
}

export async function GET(request: Request, context: LogoutRouteContext) {
  const { locale } = await context.params;
  const response = NextResponse.redirect(new URL(`/${locale}`, getLogoutRedirectBaseUrl(request)));

  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    getSessionCookieOptions({
      expires: new Date(0),
    }),
  );

  return response;
}
