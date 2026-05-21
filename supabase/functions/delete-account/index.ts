// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  } else if (allowed.length === 1) {
    corsHeaders["Access-Control-Allow-Origin"] = allowed[0];
  }

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

    // Step 1: Delete public.users row.
    // FK cascades clean up:
    //   CASCADE: attendance_records, acknowledgments, submissions, votes, push_subscriptions
    //   SET NULL: announcements.author_id, assignments.created_by, polls.created_by, timetable_slots.created_by
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

    // Step 2: Delete auth.users row
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("[delete-account] Auth cleanup failed:", deleteAuthError);
      // public.users already gone — log but return success
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
