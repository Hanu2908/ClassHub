// @ts-nocheck
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";
import { isRateLimited } from "../_shared/rateLimit.ts";

// ── Main handler ──

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { announcementId } = await req.json();
    if (!announcementId) throw new Error("announcementId is required");

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Enforce rate limiting: max 10 requests per 60 seconds per user
    const isLimited = await isRateLimited(user.id, 10, 60);
    if (isLimited) {
      return Response.json(
        { error: "Too many requests. Please wait a minute before trying again." },
        { status: 429, headers }
      );
    }

    // Fetch announcement — must be in CR's section and critical
    const { data: announcement, error: announcementError } = await serviceClient
      .from("announcements")
      .select("id, section_id, title, message_content, priority")
      .eq("id", announcementId)
      .eq("section_id", profile.section_id)
      .single();

    if (announcementError || !announcement) throw new Error("Announcement not found");

    // Get all push subscriptions for users in this section using single joined query
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth, users!inner(section_id)")
      .eq("users.section_id", profile.section_id);

    if (subError) throw subError;

    // Send push + collect batch database updates
    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];
    const successfulUserIds: string[] = [];
    const failedUserIds: string[] = [];

    await processBatched(subscriptions ?? [], async (sub) => {
      const truncatedBody = announcement.message_content.length > 200
        ? announcement.message_content.substring(0, 197) + "..."
        : announcement.message_content;

      const result = await sendWebPush(sub, {
        title: announcement.title,
        body: truncatedBody,
        url: `/app/announcements?highlight=${announcement.id}`,
        tag: "announcements",
        type: "announcement",
        announcementId: announcement.id,
        actions: [
          { action: "ack", title: "👍 Acknowledge" }
        ]
      });

      if (result.ok) {
        sent++;
        successfulUserIds.push(sub.user_id);
      } else {
        failed++;
        staleEndpoints.push(sub.endpoint);
        failedUserIds.push(sub.user_id);
      }

      return result;
    });

    // Batch update successful push notification events (no duplicates, updates trigger-created records)
    if (successfulUserIds.length > 0) {
      await serviceClient
        .from("notification_events")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .in("recipient_id", successfulUserIds)
        .eq("target_table", "announcements")
        .eq("target_id", announcement.id);
    }

    // Batch update failed push notification events
    if (failedUserIds.length > 0) {
      await serviceClient
        .from("notification_events")
        .update({
          status: "failed",
          error_message: "Push notification delivery failed",
        })
        .in("recipient_id", failedUserIds)
        .eq("target_table", "announcements")
        .eq("target_id", announcement.id);
    }

    // Batch delete stale subscriptions
    if (staleEndpoints.length > 0) {
      await serviceClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    await serviceClient.from("announcements").update({ notification_sent: true }).eq("id", announcement.id);

    return Response.json({ sent, failed, cleaned: staleEndpoints.length }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
