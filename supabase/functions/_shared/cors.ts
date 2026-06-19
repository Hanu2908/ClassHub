// @ts-nocheck
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const rawAllowed = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  
  // Parse allowed origins, stripping leading/trailing spaces, quotes, and trailing slashes
  const allowed = rawAllowed
    .split(",")
    .map(s => s.trim().replace(/^['"]|['"]$/g, "").trim().replace(/\/+$/, ""))
    .filter(Boolean);

  console.log(`[CORS] Request Origin: "${origin}" | Configured ALLOWED_ORIGINS: "${rawAllowed}" | Parsed:`, allowed);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (allowed.length === 0) {
    // No configured allowed origins — be conservative and do not set a permissive origin
    return headers;
  }

  // If origin matches configured list, echo it; otherwise do not set Access-Control-Allow-Origin (blocks unauthorized origins)
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
