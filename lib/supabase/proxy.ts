import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabasePublicConfig } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  const config = readSupabasePublicConfig(process.env);
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(
          ({
            name,
            value,
            options,
          }: {
            name: string;
            value: string;
            options: CookieOptions;
          }) => response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Verified claims, never getSession(), establish the refresh boundary.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const protectedPath = path === "/app" || path.startsWith("/app/");
  const authPath = path === "/login";

  if (protectedPath && !data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return copyAuthState(response, NextResponse.redirect(loginUrl));
  }
  if (authPath && data?.claims) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return copyAuthState(response, NextResponse.redirect(appUrl));
  }
  return response;
}

export function copyAuthState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}
