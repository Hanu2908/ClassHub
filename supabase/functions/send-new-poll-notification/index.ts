// @ts-nocheck
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";
import { isRateLimited } from "../_shared/rateLimit.ts";

// ── Main handler: Send push notifications when a new poll is created ──

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { pollId } = await req.json();
    if (!pollId) throw new Error("pollId is required");

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Enforce rate limiting: max 10 requests per 60 seconds per user
    const isLimited = await isRateLimited(user.id, 10, 60);
    if (isLimited) {
      return new Response(
        JSON.stringify({ ok: false, error: "Too many requests. Please wait a minute before trying again." }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Fetch the poll — must belong to CR's section
    const { data: poll, error: pollError } = await serviceClient
      .from("polls")
      .select("id, section_id, question_text")
      .eq("id", pollId)
      .eq("section_id", profile.section_id)
      .single();

    if (pollError || !poll) throw new Error("Poll not found");

    // Get push subscriptions for all section members (except CR who created it)
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth, users!inner(section_id)")
      .eq("users.section_id", profile.section_id);

    if (subError) throw subError;

    const notifTitle = `📊 New Poll: ${poll.question_text}`;
    const notifBody = "Cast your vote on ClassHub!";

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await processBatched(subscriptions ?? [], async (sub) => {
      // Don't push to the CR who created the poll
      if (sub.user_id === user.id) return { ok: true, error: null };

      const result = await sendWebPush(sub, {
        title: notifTitle,
        body: notifBody,
        url: `/app/polls?highlight=${poll.id}`,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        staleEndpoints.push(sub.endpoint);
      }

      return result;
    });

    // Update the notification_events records created by the DB trigger to include url/title
    await serviceClient
      .from("notification_events")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("target_table", "polls")
      .eq("target_id", poll.id);

    // Cleanup stale subscriptions
    if (staleEndpoints.length > 0) {
      await serviceClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, failed, cleaned: staleEndpoints.length }),
      { headers: { ...headers, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[send-new-poll-notification] Error:", error.message);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...headers, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
