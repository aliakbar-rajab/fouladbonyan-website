/**
 * Cloudflare Pages middleware.
 *
 * Strips legacy parameterised query strings from `/quote-process/?...` requests
 * with a permanent 301 redirect so canonicalised variants leaked from earlier
 * versions consolidate cleanly onto `/quote-process/`.
 */
export function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }

  const url = new URL(request.url);
  if (
    (url.pathname === "/quote-process" || url.pathname === "/quote-process/") &&
    url.search.length > 0
  ) {
    const destination = new URL("/quote-process/", url.origin);
    return Response.redirect(destination.href, 301);
  }

  return context.next();
}
