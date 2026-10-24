/** Next's internal request URL may use localhost while the browser uses the public host. */
export function isSameOriginCallQuery(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    const source = new URL(origin);
    return (source.protocol === "http:" || source.protocol === "https:") && source.host === host;
  } catch {
    return false;
  }
}
