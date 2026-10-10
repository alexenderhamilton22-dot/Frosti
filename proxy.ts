import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./app/lib/session";
export function proxy(request: NextRequest) {
  if (!verifySession(request.cookies.get(SESSION_COOKIE)?.value))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/",
    "/alerts",
    "/search",
    "/settings",
    "/history",
    "/inventory",
    "/add-freezer",
  ],
};
