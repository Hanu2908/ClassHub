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

// ── Main handler: Remind students with PENDING assignment submissions ──
// Only sends to students who have NOT submitted their assignment.

Deno.serve(async (req) => {
  const headers = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { assignmentId } = await req.json();
    if (!assignmentId) throw new Error("assignmentId is required");

    const ctx = getContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Fetch assignment in CR's section
    const { data: assignment, error: assignmentError } = await serviceClient
      .from("assignments")
      .select("id, section_id, title, due_date")
      .eq("id", assignmentId)
      .eq("section_id", profile.section_id)
      .single();

    if (assignmentError || !assignment) throw new Error("Assignment not found");

    // Find students with pending submissions ONLY
    const { data: pendingSubmissions, error: pendingError } = await serviceClient
      .from("submissions")
      .select("student_id")
      .eq("assignment_id", assignment.id)
      .eq("status", "pending");

    if (pendingError) throw pendingError;

    const pendingIds = (pendingSubmissions ?? []).map((r) => r.student_id);

    // Get push subscriptions only for pending students
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", pendingIds);

    if (subError) throw subError;

    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    for (const sub of subscriptions ?? []) {
      const result = await sendPush(sub, {
        title: `Assignment due: ${assignment.title}`,
        body: `Due ${new Date(assignment.due_date).toLocaleString()}`,
        url: `/app/assignments?highlight=${assignment.id}`,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        if (result.error?.includes("410") || result.error?.includes("404") || result.error?.includes("expired") || result.error?.includes("gone")) {
          await serviceClient.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          cleaned++;
        }
      }

      await serviceClient.from("notification_events").insert({
        section_id: profile.section_id,
        recipient_id: sub.user_id,
        actor_id: user.id,
        kind: "assignment_reminder",
        status: result.ok ? "sent" : "failed",
        target_table: "assignments",
        target_id: assignment.id,
        error_message: result.error,
        sent_at: result.ok ? new Date().toISOString() : null,
      });
    }

    await serviceClient.from("assignments").update({ nudge_sent: true }).eq("id", assignment.id);

    return Response.json({ pending: pendingIds.length, sent, failed, cleaned }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
