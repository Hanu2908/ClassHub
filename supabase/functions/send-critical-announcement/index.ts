import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// ── Inline helpers (self-contained for Dashboard deploy) ──

function getContext(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!supabaseUrl || !serviceRoleKey || !jwt) throw new Error("Missing env or JWT");
  return { supabaseUrl, serviceRoleKey, anonKey, jwt };
}

async function requireCr(ctx: ReturnType<typeof getContext>) {
  const userClient = createClient(ctx.supabaseUrl, ctx.anonKey, {
    global: { headers: { Authorization: `Bearer ${ctx.jwt}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) throw new Error("Invalid JWT");

  const serviceClient = createClient(ctx.supabaseUrl, ctx.serviceRoleKey);
  const { data: profile, error: profileError } = await serviceClient
    .from("users").select("id, role, section_id").eq("id", authData.user.id).single();
  if (profileError || !profile || profile.role !== "cr" || !profile.section_id) {
    throw new Error("CR role required");
  }
  return { serviceClient, user: authData.user, profile };
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string },
) {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublic || !vapidPrivate) return { ok: false, error: "Missing VAPID keys" };
  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@classhub.local",
      vapidPublic, vapidPrivate,
    );
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Push send failed" };
  }
}

function getCors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  else if (allowed.length === 1 && origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// ── Main handler ──

Deno.serve(async (req) => {
  const headers = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { announcementId } = await req.json();
    if (!announcementId) throw new Error("announcementId is required");

    const ctx = getContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Fetch announcement — must be in CR's section and critical
    const { data: announcement, error: announcementError } = await serviceClient
      .from("announcements")
      .select("id, section_id, title, message_content, priority")
      .eq("id", announcementId)
      .eq("section_id", profile.section_id)
      .single();

    if (announcementError || !announcement) throw new Error("Announcement not found");
    if (announcement.priority !== "critical") throw new Error("Only critical announcements trigger this function");

    // Get all push subscriptions for users in this section
    const { data: sectionUsers } = await serviceClient
      .from("users").select("id").eq("section_id", profile.section_id);
    const userIds = (sectionUsers ?? []).map((r) => r.id);

    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (subError) throw subError;

    // Send push to each subscription and log
    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    for (const sub of subscriptions ?? []) {
      const result = await sendPush(sub, {
        title: announcement.title,
        body: announcement.message_content,
        url: `/app/announcements?highlight=${announcement.id}`,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        // Clean up stale/expired subscriptions (410 Gone, 404 Not Found)
        if (result.error?.includes("410") || result.error?.includes("404") || result.error?.includes("expired") || result.error?.includes("gone")) {
          await serviceClient.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          cleaned++;
        }
      }

      await serviceClient.from("notification_events").insert({
        section_id: profile.section_id,
        recipient_id: sub.user_id,
        actor_id: user.id,
        kind: "critical_announcement",
        status: result.ok ? "sent" : "failed",
        target_table: "announcements",
        target_id: announcement.id,
        error_message: result.error,
        sent_at: result.ok ? new Date().toISOString() : null,
      });
    }

    await serviceClient.from("announcements").update({ notification_sent: true }).eq("id", announcement.id);

    return Response.json({ sent, failed, cleaned }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
