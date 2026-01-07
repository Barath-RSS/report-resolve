// Secure function to wipe all test data (public tables + auth users)
// CAUTION: destructive – for development / testing only

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "DELETE_ALL") {
      return new Response(JSON.stringify({ error: 'Confirm with { "confirm": "DELETE_ALL" }' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Clear public tables in dependency order
    await admin.from("reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("access_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("user_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. List + delete all auth users
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const users = usersData?.users ?? [];
    for (const u of users) {
      await admin.auth.admin.deleteUser(u.id);
    }

    return new Response(
      JSON.stringify({ success: true, deletedUsers: users.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
