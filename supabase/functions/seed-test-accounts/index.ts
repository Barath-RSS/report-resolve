// Edge function to seed test accounts for development
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
    if (confirm !== "SEED_ACCOUNTS") {
      return new Response(
        JSON.stringify({ error: 'Confirm with { "confirm": "SEED_ACCOUNTS" }' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Test accounts to create
    const accounts = [
      {
        email: "official@sathyabama.ac.in",
        password: "Official@123",
        fullName: "Test Official",
        role: "official" as const,
        registerNo: null,
      },
      {
        email: "student@test.com",
        password: "Student@123",
        fullName: "Test Student",
        role: "student" as const,
        registerNo: "41110000",
      },
    ];

    const createdAccounts = [];

    for (const account of accounts) {
      // Create auth user
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: account.fullName,
          register_no: account.registerNo,
        },
      });

      if (userError) {
        console.error(`Error creating user ${account.email}:`, userError);
        continue;
      }

      if (userData.user) {
        // The handle_new_user trigger should create profile and student role
        // For official, we need to update the role
        if (account.role === "official") {
          // Update user_roles to official
          const { error: roleError } = await admin
            .from("user_roles")
            .update({ role: "official" })
            .eq("user_id", userData.user.id);

          if (roleError) {
            console.error(`Error updating role for ${account.email}:`, roleError);
          }
        }

        createdAccounts.push({
          email: account.email,
          password: account.password,
          fullName: account.fullName,
          role: account.role,
          registerNo: account.registerNo,
          userId: userData.user.id,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, accounts: createdAccounts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Seed error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
