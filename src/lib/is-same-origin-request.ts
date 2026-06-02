/** Reject cross-site form POSTs when session cookies authenticate the request. */
export function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");

  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}
