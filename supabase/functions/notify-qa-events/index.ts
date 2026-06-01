// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    console.log(`[notify-qa-events] Webhook Triggered:`, { type, table });

    // Validate table target
    if (table !== "announcement_comments" || !record) {
      return new Response("Ignored: Not target table", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch associated announcement & author details
    const { data: announcement, error: annErr } = await serviceClient
      .from("announcements")
      .select("id, title, author_id, section_id")
      .eq("id", record.announcement_id)
      .single();

    if (annErr || !announcement) {
      throw new Error(`Announcement not found: ${annErr?.message}`);
    }

    // Helper to send push to a specific user (if not muted)
    const sendPushToUser = async (targetUserId: string, pushTitle: string, pushBody: string, kind: string) => {
      // A. Mute status check
      const { data: mute, error: muteErr } = await serviceClient
        .from("announcement_thread_mutes")
        .select("id")
        .eq("announcement_id", announcement.id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (muteErr) {
        console.error(`[notify-qa-events] Mute lookup error for user ${targetUserId}:`, muteErr);
      }
      if (mute) {
        console.log(`[notify-qa-events] Skip push: user ${targetUserId} muted this thread.`);
        return;
      }

      // B. Fetch push subscriptions
      const { data: subscriptions, error: subError } = await serviceClient
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", targetUserId);

      if (subError) {
        console.error(`[notify-qa-events] Failed to load subscriptions for user ${targetUserId}:`, subError);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`[notify-qa-events] No active push subscriptions found for user ${targetUserId}`);
        return;
      }

      const staleEndpoints: string[] = [];
      let sent = 0;

      await processBatched(subscriptions, async (sub) => {
        const result = await sendWebPush(sub, {
          title: pushTitle,
          body: pushBody,
          url: `/app/announcements?id=${announcement.id}&expand_qa=true&focus_comment=${record.id}`,
        });

        if (result.ok) {
          sent++;
        } else {
          staleEndpoints.push(sub.endpoint);
        }
        return result;
      });

      console.log(`[notify-qa-events] Sent push to user ${targetUserId} (${sent} sent, ${staleEndpoints.length} failed)`);

      // Log event in database telemetry
      try {
        await serviceClient.from("notification_events").insert({
          section_id: announcement.section_id,
          recipient_id: targetUserId,
          actor_id: record.author_id,
          kind: kind,
          status: sent > 0 ? "sent" : "failed",
          target_table: "announcements",
          target_id: announcement.id,
          title: pushTitle,
          body: pushBody,
          sent_at: sent > 0 ? new Date().toISOString() : null,
        });
      } catch (logErr) {
        console.error(`[notify-qa-events] Telemetry log failed:`, logErr);
      }

      // Cleanup stale subscriptions
      if (staleEndpoints.length > 0) {
        await serviceClient
          .from("push_subscriptions")
          .delete()
          .in("endpoint", staleEndpoints);
      }
    };

    // 2. Dispatch paths based on trigger event type
    if (type === "UPDATE" && record.is_verified && !old_record.is_verified) {
      // ── PATH A: Comment marked as Verified ──
      console.log(`[notify-qa-events] Comment ${record.id} verified. Notifying author.`);
      const notifTitle = `✓ Verified Answer`;
      const notifBody = `The CR verified an answer on your thread: "${announcement.title}"`;
      await sendPushToUser(record.author_id, notifTitle, notifBody, "qa_verified");

    } else if (type === "INSERT") {
      // Fetch comment author name for labels
      const { data: author } = await serviceClient
        .from("users")
        .select("name")
        .eq("id", record.author_id)
        .single();

      const authorName = author?.name ?? "A classmate";

      // ── PATH B: Peer-to-Peer Mention replies ──
      if (record.content.includes("@")) {
        // Fetch all section users to match name mentions in the content
        const { data: sectionUsers } = await serviceClient
          .from("users")
          .select("id, name")
          .eq("section_id", announcement.section_id);

        const mentionedUser = (sectionUsers ?? []).find(
          (u) => u.id !== record.author_id && record.content.includes(`@${u.name}`)
        );

        if (mentionedUser) {
          console.log(`[notify-qa-events] Mention detected: ${mentionedUser.name}. Notifying.`);
          const notifTitle = `New Q&A Reply`;
          const notifBody = `${authorName} replied to you: "${record.content.substring(0, 60)}..."`;
          await sendPushToUser(mentionedUser.id, notifTitle, notifBody, "qa_reply");
          
          // Return early so we don't trigger duplicate push if this user is also the CR
          return new Response(JSON.stringify({ ok: true, type: "mention" }), {
            headers: { ...headers, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // ── PATH C: Aggregated CR Notifications ──
      // If the commenter is a student (not the CR who created the announcement)
      if (record.author_id !== announcement.author_id) {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        
        // Look up if a notification was already sent to the CR in the last 15 minutes
        const { data: recentEvents, error: countErr } = await serviceClient
          .from("notification_events")
          .select("id")
          .eq("recipient_id", announcement.author_id)
          .eq("target_table", "announcements")
          .eq("target_id", announcement.id)
          .eq("kind", "qa_question_agg")
          .gt("created_at", fifteenMinsAgo);

        if (countErr) {
          console.error(`[notify-qa-events] Aggregation lookup error:`, countErr);
        }

        const shouldNotifyCR = !recentEvents || recentEvents.length === 0;

        if (shouldNotifyCR) {
          console.log(`[notify-qa-events] CR alert triggered (Aggregation safety cleared).`);
          const notifTitle = `New Class Question`;
          const notifBody = `Students are posting questions on your notice: "${announcement.title}"`;
          await sendPushToUser(announcement.author_id, notifTitle, notifBody, "qa_question_agg");
        } else {
          console.log(`[notify-qa-events] CR alert throttled (aggregated in 15m window).`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[notify-qa-events] Error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
