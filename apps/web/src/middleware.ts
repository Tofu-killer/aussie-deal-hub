import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionCookieOptions, SESSION_COOKIE_MAX_AGE, SESSION_COOKIE_NAME } from "./lib/session";

export function middleware(request: NextRequest) {
  const sessionToken = request.nextUrl.searchParams.get("sessionToken");

  if (!sessionToken) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.searchParams.delete("sessionToken");

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    sessionToken,
    getSessionCookieOptions({
      maxAge: SESSION_COOKIE_MAX_AGE,
    }),
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|health|ready|robots.txt|sitemap.xml).*)"],
};
