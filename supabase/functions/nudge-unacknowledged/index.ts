// @ts-nocheck
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";

// ── Main handler: Nudge unacknowledged students ──
// Only sends to students in the CR's section who HAVEN'T acknowledged a critical announcement.

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { announcementId, studentId } = await req.json();
    if (!announcementId) throw new Error("announcementId is required");

    const ctx = getFunctionContext(req);
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

    await processBatched(subscriptions ?? [], async (sub) => {
      const result = await sendWebPush(sub, {
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

      return result;
    });

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
