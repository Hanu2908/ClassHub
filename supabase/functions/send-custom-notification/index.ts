// @ts-nocheck
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";

// ── Main handler: Send custom CR notification to all section members ──

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { title, body, sectionId } = await req.json();

    console.log(`[send-custom-notification] Request:`, { title, body, sectionId });

    if (!title || !body || !sectionId) {
      return new Response(JSON.stringify({ error: "Missing title, body, or sectionId" }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Verify CR owns this section
    if (profile.section_id !== sectionId) {
      throw new Error("Only the CR of this section can send notifications");
    }

    // Fetch all subscriptions for users in this section
    const { data: subscriptions, error: subsError } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id, users!inner(section_id)")
      .eq("users.section_id", sectionId);

    if (subsError) throw subsError;

    console.log(`[send-custom-notification] Found ${subscriptions?.length || 0} subscriptions for section ${sectionId}`);

    // Send pushes + log events in batches with fault isolation
    const staleIds: string[] = [];
    const notificationEvents: any[] = [];
    let sent = 0;
    let failed = 0;

    await processBatched(subscriptions ?? [], async (subRecord) => {
      const result = await sendWebPush(subRecord, {
        title,
        body,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        staleIds.push(subRecord.endpoint);
      }

      // Collect event in notification_events with correct column name and enum value
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
