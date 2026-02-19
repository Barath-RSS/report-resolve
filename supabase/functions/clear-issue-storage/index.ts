// Clears ONLY resolved report records and their associated images from the `issue-images` bucket.
// Other reports (pending, investigating) remain untouched.
// Protected: only users with the `official` role can execute.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return json(500, { error: "Server not configured" });
    }

    // Validate JWT and extract userId
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = claimsData.claims.sub;

    // Elevated client
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Authorize: must be official
    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) return json(500, { error: "Unable to verify role" });
    const isOfficial = (roles ?? []).some((r) => (r as { role?: string }).role === "official");
    if (!isOfficial) return json(403, { error: "Forbidden" });

    // Fetch all RESOLVED reports to get their image URLs
    const { data: resolvedReports, error: fetchError } = await admin
      .from("reports")
      .select("id, image_url, completion_image_url")
      .eq("status", "resolved");

    if (fetchError) throw fetchError;

    const resolvedReportsList = resolvedReports ?? [];

    // Collect image paths to delete from storage
    const imagePaths: string[] = [];
    for (const report of resolvedReportsList) {
      if (report.image_url) {
        // Extract file path from public URL
        const urlParts = report.image_url.split("/issue-images/");
        if (urlParts.length > 1) {
          imagePaths.push(urlParts[1]);
        }
      }
      if (report.completion_image_url) {
        const urlParts = report.completion_image_url.split("/issue-images/");
        if (urlParts.length > 1) {
          imagePaths.push(urlParts[1]);
        }
      }
    }

    // Delete images from storage (in chunks)
    const bucket = admin.storage.from("issue-images");
    let deletedFiles = 0;
    if (imagePaths.length > 0) {
      for (let i = 0; i < imagePaths.length; i += 100) {
        const chunk = imagePaths.slice(i, i + 100);
        const { error } = await bucket.remove(chunk);
        if (error) console.warn("Storage delete error:", error.message);
        else deletedFiles += chunk.length;
      }
    }

    // Delete resolved reports from DB
    const resolvedIds = resolvedReportsList.map((r) => r.id);
    let deletedReports = 0;
    if (resolvedIds.length > 0) {
      const { count, error: deleteError } = await admin
        .from("reports")
        .delete({ count: "exact" })
        .in("id", resolvedIds);

      if (deleteError) throw deleteError;
      deletedReports = count ?? resolvedIds.length;
    }

    return json(200, { deletedFiles, deletedReports });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});
