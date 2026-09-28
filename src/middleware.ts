import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/cron/* authenticates itself with a bearer secret (no user session).
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/", "/offline", "/api/cron/", "/invite/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * Refreshes the Supabase session on every request and blocks unauthenticated
 * access to anything except the auth pages. RLS in the database remains the
 * real security boundary — this only provides the UX redirect.
 */
export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname, search } = request.nextUrl;

  if (!url || !key) {
    // Not configured: only the login page (which explains the problem) is reachable.
    if (!isPublic(pathname)) return NextResponse.redirect(new URL("/login", request.url));
    return withHeaders(response);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    // API clients (offline sync, exports) get a JSON 401 instead of an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return withHeaders(NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 }));
    }
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    if (hadSession) login.searchParams.set("expired", "1");
    return withHeaders(NextResponse.redirect(login));
  }

  if (user && pathname === "/login") {
    return withHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return withHeaders(response);
}

function withHeaders(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: [
    // everything except static assets, images, PWA files
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|geo/|maplibre/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
