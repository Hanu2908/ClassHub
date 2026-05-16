import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type FunctionContext = {
  supabaseUrl: string;
  serviceRoleKey: string;
  jwt: string;
};

export function getFunctionContext(req: Request): FunctionContext {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase function environment");
  }

  if (!jwt) {
    throw new Error("Missing user JWT");
  }

  return { supabaseUrl, serviceRoleKey, jwt };
}

export async function requireCr(ctx: FunctionContext) {
  const userClient = createClient(ctx.supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${ctx.jwt}` } },
  });

  const { data: authUser, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser.user) {
    throw new Error("Invalid user JWT");
  }

  const serviceClient = createClient(ctx.supabaseUrl, ctx.serviceRoleKey);
  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("id, role, section_id")
    .eq("id", authUser.user.id)
    .single();

  if (profileError || !profile || profile.role !== "cr" || !profile.section_id) {
    throw new Error("CR role required");
  }

  return { serviceClient, user: authUser.user, profile };
}
