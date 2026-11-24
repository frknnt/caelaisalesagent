import { loaderEtag, loaderScript } from "@/lib/widget/generated/assets";

// Public and static: no key, no site and no session is involved here. Customer
// pages may keep it for five minutes, so a rollback reaches them quickly.
export function GET(request: Request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Content-Type": "text/javascript; charset=utf-8",
    "Cross-Origin-Resource-Policy": "cross-origin",
    ETag: loaderEtag,
    "X-Content-Type-Options": "nosniff",
  };
  return request.headers.get("if-none-match") === loaderEtag
    ? new Response(null, { status: 304, headers })
    : new Response(loaderScript, { headers });
}
