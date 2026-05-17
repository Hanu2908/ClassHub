import { getCorsHeaders } from "../_shared/cors.ts";
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { sendWebPush } from "../_shared/push.ts";

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { assignmentId } = await req.json();
    if (!assignmentId) throw new Error("assignmentId is required");

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    const { data: assignment, error: assignmentError } = await serviceClient
      .from("assignments")
      .select("id, section_id, title, due_date")
      .eq("id", assignmentId)
      .eq("section_id", profile.section_id)
      .single();

    if (assignmentError || !assignment) throw new Error("Assignment not found");

    const { data: pendingSubmissions, error: pendingError } = await serviceClient
      .from("submissions")
      .select("student_id")
      .eq("assignment_id", assignment.id)
      .eq("status", "pending");

    if (pendingError) throw pendingError;

    const pendingIds = (pendingSubmissions ?? []).map((row) => row.student_id);
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", pendingIds);

    if (subError) throw subError;

    for (const sub of subscriptions ?? []) {
      const result = await sendWebPush(sub, {
        title: `Assignment due: ${assignment.title}`,
        body: `Due ${new Date(assignment.due_date).toLocaleString()}`,
        url: `/app/assignments?highlight=${assignment.id}`,
      });

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

    return Response.json({ pending: pendingIds.length, sent: subscriptions?.length ?? 0 }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
