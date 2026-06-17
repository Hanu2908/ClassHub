// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import { getFunctionContext, requireDeveloper } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const ctx = getFunctionContext(req);
    const { serviceClient } = await requireDeveloper(ctx);

    const body = await req.json().catch(() => ({}));
    const { action = "get-summary", sectionId } = body;

    if (action === "purge") {
      // Delete all events older than 60 days
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { error: deleteErr, count } = await serviceClient
        .from("analytics_events")
        .delete()
        .lt("created_at", cutoff);

      if (deleteErr) throw deleteErr;

      return new Response(
        JSON.stringify({ success: true, purgedCount: count || 0 }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (!sectionId) {
      return new Response(
        JSON.stringify({ error: "sectionId is required for summary" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Fetch all events in the section for the last 14 days
    const last14DaysDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: allEvents, error: eventsErr } = await serviceClient
      .from("analytics_events")
      .select("user_id, event_name, created_at")
      .eq("section_id", sectionId)
      .gt("created_at", last14DaysDate);

    if (eventsErr) throw eventsErr;

    // Filter events
    const appOpenedEvents = allEvents.filter(e => e.event_name === "app_opened");
    
    // Cut-off for W1 (last 7 days) vs W2 (7-14 days ago)
    const cutOffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const w1ActiveUsers = new Set<string>();
    const w2ActiveUsers = new Set<string>();

    appOpenedEvents.forEach(e => {
      const t = new Date(e.created_at).getTime();
      if (t >= cutOffMs) {
        w1ActiveUsers.add(e.user_id);
      } else {
        w2ActiveUsers.add(e.user_id);
      }
    });

    // WAU count (active this week)
    const activeWauCount = w1ActiveUsers.size;

    // Fetch total students/CRs in section
    const { data: students, error: studentsErr } = await serviceClient
      .from("users")
      .select("id, name, email")
      .eq("section_id", sectionId)
      .in("role", ["student", "cr"]);

    if (studentsErr) throw studentsErr;

    const totalStudentsCount = students.length;
    const wauPercentage = totalStudentsCount > 0 
      ? Math.round((activeWauCount / totalStudentsCount) * 100) 
      : 0;

    // --- Metric 2: DAU Sparkline (last 7 days) ---
    const getISTDateString = (dateStr: string) => {
      const date = new Date(dateStr);
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5)); // IST is UTC + 5:30
      return istDate.toISOString().split("T")[0];
    };

    const dauSeries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5));
      const dateStr = istDate.toISOString().split("T")[0];
      dauSeries.push({ date: dateStr, count: 0 });
    }

    const dailyUsersMap = new Map<string, Set<string>>();
    dauSeries.forEach(d => dailyUsersMap.set(d.date, new Set()));

    appOpenedEvents.forEach(e => {
      const t = new Date(e.created_at).getTime();
      if (t >= cutOffMs) {
        const dateStr = getISTDateString(e.created_at);
        const userSet = dailyUsersMap.get(dateStr);
        if (userSet) {
          userSet.add(e.user_id);
        }
      }
    });

    dauSeries.forEach(d => {
      d.count = dailyUsersMap.get(d.date)!.size;
    });

    // --- Metric 3: Retention (W2 active users returning in W1) ---
    const w2Count = w2ActiveUsers.size;
    let returned7d = 0;
    w2ActiveUsers.forEach(userId => {
      if (w1ActiveUsers.has(userId)) {
        returned7d++;
      }
    });
    const retentionPercentage = w2Count > 0 
      ? Math.round((returned7d / w2Count) * 100) 
      : 0;

    // --- Metric 4: Feature Usage Ranking (last 7 days, excluding app_opened) ---
    const featureEvents = allEvents.filter(e => {
      const t = new Date(e.created_at).getTime();
      return t >= cutOffMs && e.event_name !== "app_opened";
    });

    const rankingMap = new Map<string, number>();
    featureEvents.forEach(e => {
      rankingMap.set(e.event_name, (rankingMap.get(e.event_name) || 0) + 1);
    });

    const featureRanking = Array.from(rankingMap.entries())
      .map(([event_name, count]) => ({ event_name, count }))
      .sort((a, b) => b.count - a.count);

    // --- Metric 5: Inactive Students List (no app_opened in last 7 days) ---
    const inactiveStudentsList = students.filter(s => !w1ActiveUsers.has(s.id));
    const inactiveIds = inactiveStudentsList.map(s => s.id);

    const lastSeenMap = new Map<string, string>();

    if (inactiveIds.length > 0) {
      const { data: lastSeenEvents } = await serviceClient
        .from("analytics_events")
        .select("user_id, created_at")
        .in("user_id", inactiveIds)
        .eq("event_name", "app_opened");

      if (lastSeenEvents) {
        lastSeenEvents.forEach(e => {
          const currentLast = lastSeenMap.get(e.user_id);
          if (!currentLast || new Date(e.created_at) > new Date(currentLast)) {
            lastSeenMap.set(e.user_id, e.created_at);
          }
        });
      }
    }

    const inactiveStudents = inactiveStudentsList.map(s => ({
      name: s.name,
      email: s.email,
      lastSeen: lastSeenMap.get(s.id) || "Never"
    })).sort((a, b) => {
      if (a.lastSeen === "Never") return -1;
      if (b.lastSeen === "Never") return 1;
      return new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
    });

    const summary = {
      wau: {
        active: activeWauCount,
        total: totalStudentsCount,
        percentage: wauPercentage
      },
      dauSeries,
      retention: {
        returned7d,
        percentage: retentionPercentage
      },
      featureRanking,
      inactiveStudents
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[get-analytics-summary] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
