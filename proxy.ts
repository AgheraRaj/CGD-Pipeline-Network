import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || getSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackURL", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skips API routes, Next internals and files in /public (anything with a dot).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};