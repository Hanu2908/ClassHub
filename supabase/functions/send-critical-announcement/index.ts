import { corsHeaders } from "../_shared/cors.ts";
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { sendWebPush } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { announcementId } = await req.json();
    if (!announcementId) throw new Error("announcementId is required");

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    const { data: announcement, error: announcementError } = await serviceClient
      .from("announcements")
      .select("id, section_id, title, message_content, priority")
      .eq("id", announcementId)
      .eq("section_id", profile.section_id)
      .single();

    if (announcementError || !announcement) throw new Error("Announcement not found");
    if (announcement.priority !== "critical") throw new Error("Only critical announcements trigger this function");

    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", (
        await serviceClient.from("users").select("id").eq("section_id", profile.section_id)
      ).data?.map((row) => row.id) ?? []);

    if (subError) throw subError;

    for (const sub of subscriptions ?? []) {
      const result = await sendWebPush(sub, {
        title: announcement.title,
        body: announcement.message_content,
        url: `/app/announcements?highlight=${announcement.id}`,
      });

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

    return Response.json({ sent: subscriptions?.length ?? 0 }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
