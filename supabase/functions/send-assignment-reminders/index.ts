// @ts-nocheck
import { getFunctionContext, requireCr } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "../_shared/push.ts";
import { processBatched } from "../_shared/batch.ts";

// ── Main handler: Remind students with PENDING assignment submissions ──
// Only sends to students who have NOT submitted their assignment.

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { assignmentId, studentId } = await req.json();
    if (!assignmentId) throw new Error("assignmentId is required");

    const ctx = getFunctionContext(req);
    const { serviceClient, profile, user } = await requireCr(ctx);

    // Fetch assignment in CR's section
    const { data: assignment, error: assignmentError } = await serviceClient
      .from("assignments")
      .select("id, section_id, title, due_date")
      .eq("id", assignmentId)
      .eq("section_id", profile.section_id)
      .single();

    if (assignmentError || !assignment) throw new Error("Assignment not found");

    let pendingIds: string[] = [];
    if (studentId) {
      // Check if student's submission is pending/not submitted
      const { data: sub, error: subErr } = await serviceClient
        .from("submissions")
        .select("status")
        .eq("assignment_id", assignment.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (subErr) throw subErr;
      if (!sub || sub.status === "pending") {
        pendingIds = [studentId];
      }
    } else {
      // Find students with pending submissions ONLY
      const { data: pendingSubmissions, error: pendingError } = await serviceClient
        .from("submissions")
        .select("student_id")
        .eq("assignment_id", assignment.id)
        .eq("status", "pending");

      if (pendingError) throw pendingError;
      pendingIds = (pendingSubmissions ?? []).map((r: { student_id: string }) => r.student_id);
    }

    if (pendingIds.length === 0) {
      return Response.json({ pending: 0, sent: 0 }, { headers });
    }

    // Get push subscriptions only for pending students
    const { data: subscriptions, error: subError } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", pendingIds);

    if (subError) throw subError;

    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    const notifTitle = `Assignment due: ${assignment.title}`;
    const notifBody = `Due ${new Date(assignment.due_date).toLocaleString()}`;

    await processBatched(subscriptions ?? [], async (sub) => {
      const result = await sendWebPush(sub, {
        title: notifTitle,
        body: notifBody,
        url: `/app/assignments?highlight=${assignment.id}`,
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
        kind: "assignment_reminder",
        status: result.ok ? "sent" : "failed",
        target_table: "assignments",
        target_id: assignment.id,
        title: notifTitle,
        body: notifBody,
        error_message: result.error,
        sent_at: result.ok ? new Date().toISOString() : null,
      });

      return result;
    });

    if (!studentId) {
      await serviceClient.from("assignments").update({ nudge_sent: true }).eq("id", assignment.id);
    }

    return Response.json({ pending: pendingIds.length, sent, failed, cleaned }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("CR role required") ? 403 : 400;
    return Response.json({ error: message }, { status, headers });
  }
});
