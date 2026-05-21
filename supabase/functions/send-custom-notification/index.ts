import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || ""
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || ""
const VAPID_SUBJECT = "mailto:admin@classhub.com"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { title, body, sectionId } = await req.json()

    console.log(`[send-custom-notification] Request:`, { title, body, sectionId })

    if (!title || !body || !sectionId) {
      return new Response(JSON.stringify({ error: "Missing title, body, or sectionId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // 1. Verify user is a CR for this section
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !userData.user) throw new Error("Unauthorized")

    const { data: authorData, error: authorError } = await supabaseClient
      .from("users")
      .select("role, section_id")
      .eq("id", userData.user.id)
      .single()

    if (authorError || authorData.role !== "cr" || authorData.section_id !== sectionId) {
      throw new Error("Only the CR of this section can send notifications")
    }

    // 2. Fetch all subscriptions for users in this section
    const { data: subscriptions, error: subsError } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id, users!inner(section_id)")
      .eq("users.section_id", sectionId)

    if (subsError) throw subsError

    console.log(`[send-custom-notification] Found ${subscriptions?.length || 0} subscriptions for section ${sectionId}`)

    // 3. Setup web-push
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    // 4. Send pushes
    const payload = {
      title: title,
      body: body,
      type: "system"
    }

    const staleIds: string[] = []
    let sent = 0
    let failed = 0

    await Promise.all((subscriptions || []).map(async (subRecord) => {
      const sub = {
        endpoint: subRecord.endpoint,
        keys: {
          p256dh: subRecord.p256dh,
          auth: subRecord.auth
        }
      }

      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify(payload)
        )
        sent++
        
        // Log event
        await serviceClient.from("notification_events").insert({
          recipient_id: subRecord.user_id,
          title: payload.title,
          body: payload.body,
          type: "system",
          status: "sent",
        })
      } catch (err: any) {
        failed++
        staleIds.push(subRecord.endpoint)
      }
    }))

    // 5. Cleanup stale subscriptions
    if (staleIds.length > 0) {
      await serviceClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleIds)
    }

    // 6. Broadcast Realtime event to trigger Bell Icon
    const channel = serviceClient.channel(`section-${sectionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'custom_notification',
      payload: { title, body }
    })

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        failed,
        cleaned: staleIds.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error("[send-custom-notification] Error:", error.message)
    // Return 200 with ok: false so frontend doesn't crash on parse
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  }
})
