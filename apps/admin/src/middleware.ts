import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildAdminBasicAuthChallenge, getAdminBasicAuthConfig, hasValidAdminBasicAuth } from "./lib/access";

export function middleware(request: NextRequest) {
  if (!getAdminBasicAuthConfig()) {
    return NextResponse.next();
  }

  if (hasValidAdminBasicAuth(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": buildAdminBasicAuthChallenge(),
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|health|ready).*)"],
};
