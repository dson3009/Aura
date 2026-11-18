import { NextRequest, NextResponse } from "next/server";

// Route protection map: path prefix → allowed roles
const PROTECTED: Record<string, string[]> = {
  "/customer": ["customer"],
  "/staff": ["staff"],
  "/manager": ["manager"],
  "/admin": ["admin", "owner"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRscRequest =
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-state-tree") ||
    request.headers.get("next-router-prefetch") === "1";
  const isDocumentRequest =
    !isRscRequest && (request.headers.get("accept") ?? "").includes("text/html");

  const matchedPrefix = Object.keys(PROTECTED).find((prefix) =>
    pathname.startsWith(prefix)
  );

  const role = request.cookies.get("auraspa_role")?.value;

  // 1. If visiting landing page '/' or login page '/login' and already logged in, redirect to respective dashboard
  if (isDocumentRequest && (pathname === "/" || pathname === "/login") && role) {
    const redirects: Record<string, string> = {
      customer: "/customer",
      staff: "/staff",
      manager: "/manager",
      admin: "/admin",
      owner: "/admin",
    };
    const dest = redirects[role];
    if (dest) {
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  // 2. If it's a protected route
  if (matchedPrefix) {
    // Not logged in → redirect to login
    if (!role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Wrong role → redirect to their own dashboard
    const allowedRoles = PROTECTED[matchedPrefix];
    if (!allowedRoles.includes(role)) {
      const redirects: Record<string, string> = {
        customer: "/customer",
        staff: "/staff",
        manager: "/manager",
        admin: "/admin",
        owner: "/admin",
      };
      const dest = redirects[role] ?? "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/customer/:path*",
    "/staff/:path*",
    "/manager/:path*",
    "/admin/:path*",
  ],
};
