// @ts-nocheck
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

// ── Main handler: Nudge unacknowledged students ──
// Only sends to students in the CR's section who HAVEN'T acknowledged a critical announcement.

Deno.serve(async (req: Request) => {
  const headers = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { announcementId, studentId } = await req.json();
    if (!announcementId) throw new Error("announcementId is required");

    const ctx = getContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Fetch critical announcement in CR's section
    const { data: announcement, error: announcementError } = await serviceClient
      .from("announcements")
      .select("id, section_id, title, message_content, priority, nudge_sent")
      .eq("id", announcementId)
      .eq("section_id", profile.section_id)
      .single();

    if (announcementError || !announcement) throw new Error("Announcement not found");
    if (announcement.priority !== "critical") throw new Error("Only critical announcements can be nudged");
    if (!studentId && announcement.nudge_sent) throw new Error("Nudge already sent");

    let unacknowledgedIds: string[] = [];
    if (studentId) {
      // Check if student has acknowledged the critical announcement
      const { data: ack, error: ackErr } = await serviceClient
        .from("acknowledgments")
        .select("id")
        .eq("announcement_id", announcement.id)
        .eq("user_id", studentId)
        .maybeSingle();
      if (ackErr) throw ackErr;
      if (!ack) {
        unacknowledgedIds = [studentId];
      }
    } else {
      // Get all students in section
      const { data: recipients, error: recipientError } = await serviceClient
        .from("users").select("id").eq("section_id", profile.section_id).eq("role", "student");
      if (recipientError) throw recipientError;

      // Find who already acknowledged
      const { data: acknowledged } = await serviceClient
        .from("acknowledgments").select("user_id").eq("announcement_id", announcement.id);
      const acknowledgedIds = new Set((acknowledged ?? []).map((r: { user_id: string }) => r.user_id));

      // Only unacknowledged students
      unacknowledgedIds = (recipients ?? []).map((r: { id: string }) => r.id).filter((id: string) => !acknowledgedIds.has(id));
    }

    if (unacknowledgedIds.length === 0) {
      return Response.json({ recipients: 0, sent: 0 }, { headers });
    }

    // Get push subscriptions only for unacknowledged students
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", unacknowledgedIds);

    if (subError) throw subError;

    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    const notifTitle = `Reminder: ${announcement.title}`;
    const notifBody = "Please acknowledge this critical ClassHub notice.";
    for (const sub of subscriptions ?? []) {
      const result = await sendPush(sub, {
        title: notifTitle,
        body: notifBody,
        url: `/app/announcements?highlight=${announcement.id}`,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        await serviceClient.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        cleaned++;
      }

      await serviceClient.from("notification_events").insert({
        section_id: profile.section_id,
        recipient_id: sub.user_id,
        actor_id: user.id,
        kind: "ack_nudge",
        status: result.ok ? "sent" : "failed",
        target_table: "announcements",
        target_id: announcement.id,
        title: notifTitle,
        body: notifBody,
        error_message: result.error,
        sent_at: result.ok ? new Date().toISOString() : null,
      });
    }

    if (!studentId) {
      await serviceClient.from("announcements").update({ nudge_sent: true }).eq("id", announcement.id);
    }

    return Response.json({ recipients: unacknowledgedIds.length, sent, failed, cleaned }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
