// @ts-nocheck
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

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
