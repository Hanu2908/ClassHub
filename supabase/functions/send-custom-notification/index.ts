// @ts-nocheck
import { getFunctionContext, requireCrOrTeacher } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";
import { isRateLimited } from "../_shared/rateLimit.ts";

// ── Main handler: Send custom notification to all section members ──

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { title, body, sectionId, skipDbInsert } = await req.json();

    console.log(`[send-custom-notification] Request:`, { title, body, sectionId, skipDbInsert });

    if (!title || !body || !sectionId) {
      return new Response(JSON.stringify({ error: "Missing title, body, or sectionId" }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCrOrTeacher(ctx);

    // Enforce rate limiting: max 10 requests per 60 seconds per user
    const isLimited = await isRateLimited(user.id, 10, 60);
    if (isLimited) {
      return new Response(JSON.stringify({ ok: false, error: "Too many requests. Please wait a minute before trying again." }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Verify user belongs to this section
    if (profile.section_id !== sectionId) {
      throw new Error("Only an authorized CR or Teacher of this section can send notifications");
    }

    // Fetch all subscriptions for users in this section who have notifications_enabled = true
    const { data: subscriptions, error: subsError } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id, users!inner(section_id, notifications_enabled)")
      .eq("users.section_id", sectionId)
      .eq("users.notifications_enabled", true);

    if (subsError) throw subsError;

    console.log(`[send-custom-notification] Found ${subscriptions?.length || 0} subscriptions for section ${sectionId}`);

    // Send pushes + log events in batches with fault isolation
    const staleIds: string[] = [];
    const notificationEvents: any[] = [];
    let sent = 0;
    let failed = 0;

    const loggedUserIds = new Set<string>();

    await processBatched(subscriptions ?? [], async (subRecord) => {
      const truncatedBody = body.length > 200 ? body.substring(0, 197) + "..." : body;

      const result = await sendWebPush(subRecord, {
        title,
        body: truncatedBody,
        url: '/app/home',
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        staleIds.push(subRecord.endpoint);
      }

      // Collect event in notification_events with correct column name and enum value
      if (!skipDbInsert && !loggedUserIds.has(subRecord.user_id)) {
        loggedUserIds.add(subRecord.user_id);
        notificationEvents.push({
          section_id: sectionId,
          recipient_id: subRecord.user_id,
          actor_id: user.id,
          kind: "custom",
          status: result.ok ? "sent" : "failed",
          target_table: "announcements",
          title,
          body,
          error_message: result.error,
          sent_at: result.ok ? new Date().toISOString() : null,
        });
      }

      return result;
    });

    // Batch insert notification events
    if (notificationEvents.length > 0) {
      await serviceClient.from("notification_events").insert(notificationEvents);
    }

    // Cleanup stale subscriptions
    if (staleIds.length > 0) {
      await serviceClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        failed,
        cleaned: staleIds.length,
      }),
      {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[send-custom-notification] Error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
