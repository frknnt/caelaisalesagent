import { NextResponse, type NextRequest } from "next/server";

import {
  applyRequestContext,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-context";
import { updateSession } from "@/lib/supabase/proxy";

const isWidgetPath = (path: string) =>
  path.startsWith("/widget/") || path.startsWith("/api/widget/");

export async function proxy(request: NextRequest) {
  const context = applyRequestContext(request.headers);
  // Widget requests come from customer pages. They never read, refresh or set
  // the panel's sign-in cookies.
  const response = isWidgetPath(request.nextUrl.pathname)
    ? NextResponse.next({ request })
    : await updateSession(request);
  response.headers.set(REQUEST_ID_HEADER, context.requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
