// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

/**
 * delete-account — permanently deletes the calling user's account.
 * Self-contained (no _shared/ imports) for Dashboard deployment.
 *
 * Flow:
 * 1. Verify JWT → extract user ID (no client trust)
 * 2. Delete public.users row (FK cascades handle child rows)
 * 3. Delete auth.users row via admin API
 */
Deno.serve(async (req: Request) => {
  // CORS — fall back to wildcard when ALLOWED_ORIGINS is not configured.
  // Auth security comes from JWT verification below, not from origin restriction.
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowed.includes(origin)
      ? origin
      : allowed.length === 1
      ? allowed[0]
      : "*", // default to wildcard — JWT is the real security gate
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

    if (!supabaseUrl || !serviceRoleKey || !jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT — use anon client so RLS applies, proving token is valid
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: authData, error: authError } = await anonClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 1a: Null out attachments.uploaded_by (ON DELETE RESTRICT → must clear manually)
    const { error: attachErr } = await serviceClient
      .from("attachments")
      .update({ uploaded_by: null })
      .eq("uploaded_by", userId);
    if (attachErr) {
      console.error("[delete-account] Failed to clear attachments.uploaded_by:", attachErr);
      // We log but don't fail, to let the cascading deletion attempt it
    }

    // Step 1b: Null out cr_transfer_log references to avoid FK constraint issues
    await serviceClient
      .from("cr_transfer_log")
      .update({ actor_id: null })
      .eq("actor_id", userId);

    await serviceClient
      .from("cr_transfer_log")
      .update({ target_id: null })
      .eq("target_id", userId);

    // Step 2: Delete public.users row.
    // FK cascades clean up:
    //   CASCADE: attendance_records, acknowledgments, submissions, votes, push_subscriptions
    //   SET NULL: announcements.author_id, assignments.created_by, polls.created_by,
    //             timetable_slots.created_by, sections.created_by, attachments.uploaded_by
    const { error: deleteUserError } = await serviceClient
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteUserError) {
      console.error("[delete-account] Failed to delete public.users row:", deleteUserError);
      return new Response(
        JSON.stringify({ error: "Failed to delete user data", detail: deleteUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Delete auth.users row — MUST succeed to avoid orphaned auth identity
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("[delete-account] Auth cleanup failed:", deleteAuthError);
      // public.users already gone but auth.users persists with email — report failure
      return new Response(
        JSON.stringify({
          error: "Account data deleted but auth identity removal failed. Please contact support.",
          detail: deleteAuthError.message,
          partial: true,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
