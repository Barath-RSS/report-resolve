// Clears all report records and deletes all files from the `issue-images` bucket.
// Protected: only users with the `official` role can execute.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StorageItem = {
  name: string;
  id?: string;
  metadata?: Record<string, unknown> | null;
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

    // Elevated client to delete storage objects + reports
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Authorize: must be official
    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) return json(500, { error: "Unable to verify role" });
    const isOfficial = (roles ?? []).some((r) => (r as { role?: string }).role === "official");
    if (!isOfficial) return json(403, { error: "Forbidden" });

    // Recursively collect all file paths
    const bucket = admin.storage.from("issue-images");

    const collectPaths = async (prefix = ""): Promise<string[]> => {
      const paths: string[] = [];
      let offset = 0;
      const limit = 1000;

      while (true) {
        const { data, error } = await bucket.list(prefix, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

        if (error) throw error;

        const items = (data ?? []) as StorageItem[];
        if (items.length === 0) break;

        for (const item of items) {
          const isFolder = item.metadata == null;
          const nextPrefix = prefix ? `${prefix}/${item.name}` : item.name;

          if (isFolder) {
            const nested = await collectPaths(nextPrefix);
            paths.push(...nested);
          } else {
            paths.push(nextPrefix);
          }
        }

        if (items.length < limit) break;
        offset += items.length;
      }

      return paths;
    };

    const allPaths = await collectPaths("");

    // Delete in chunks to avoid request size limits
    let deletedFiles = 0;
    for (let i = 0; i < allPaths.length; i += 1000) {
      const chunk = allPaths.slice(i, i + 1000);
      const { error } = await bucket.remove(chunk);
      if (error) throw error;
      deletedFiles += chunk.length;
    }

    // Count reports (for UI feedback)
    const { count: reportCount, error: reportCountError } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true });

    if (reportCountError) {
      // Don't fail the whole operation; just skip the count.
      console.warn("Unable to count reports:", reportCountError);
    }

    // Delete all reports
    const { error: reportsError } = await admin
      .from("reports")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (reportsError) throw reportsError;

    return json(200, { deletedFiles, deletedReports: reportCount ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});
