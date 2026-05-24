// ==========================================
// SUPABASE EDGE FUNCTION: cleanup-expired
// ==========================================
// Deploy this function via Supabase CLI:
//   supabase functions deploy cleanup-expired
//
// Trigger it using pg_cron (inside Supabase SQL Editor):
//   select cron.schedule('cleanup-every-minute', '* * * * *', 'select net.http_post(url:=''https://<project-ref>.supabase.co/functions/v1/cleanup-expired'', headers:=''{"Authorization": "Bearer <service-role-key>"}'')');

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Collect environmental variables inside the edge function
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).");
    }

    // Initialize Supabase admin client to bypass RLS and operate storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    const nowIso = new Date().toISOString();

    // 1. Find all non-expired sessions where expires_at is in the past
    const { data: expiredSessions, error: sessionFetchError } = await supabase
      .from("upload_sessions")
      .select(`
        id,
        share_token,
        files (
          id,
          storage_path
        )
      `)
      .lt("expires_at", nowIso)
      .eq("is_expired", false);

    if (sessionFetchError) {
      throw sessionFetchError;
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      return new Response(JSON.stringify({ message: "No expired sessions found.", cleaned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found ${expiredSessions.length} expired sessions to cleanup.`);

    // 2. Gather all storage paths of files that need deletion
    const storagePathsToDelete: string[] = [];
    const sessionIdsToMarkExpired: string[] = [];

    for (const session of expiredSessions) {
      sessionIdsToMarkExpired.push(session.id);
      if (session.files && Array.isArray(session.files)) {
        for (const file of session.files) {
          if (file.storage_path) {
            storagePathsToDelete.push(file.storage_path);
          }
        }
      }
    }

    // 3. Delete files from storage bucket in chunks of 50 (if any)
    let storageDeletedCount = 0;
    if (storagePathsToDelete.length > 0) {
      console.log(`Deleting ${storagePathsToDelete.length} files from dropzeo-files storage.`);
      
      const chunkSize = 50;
      for (let i = 0; i < storagePathsToDelete.length; i += chunkSize) {
        const chunk = storagePathsToDelete.slice(i, i + chunkSize);
        const { data: deleted, error: storageError } = await supabase.storage
          .from("dropzeo-files")
          .remove(chunk);

        if (storageError) {
          console.error(`Error deleting storage files chunk:`, storageError);
        } else if (deleted) {
          storageDeletedCount += deleted.length;
        }
      }
    }

    // 4. Mark is_expired = true in database
    // This will trigger cascade delete (if configured) on public.files or we let Supabase CASCADE referential actions handle it.
    // If we have cascade triggers on the DB they will automatically erase DB rows.
    const { error: updateError } = await supabase
      .from("upload_sessions")
      .update({ is_expired: true })
      .in("id", sessionIdsToMarkExpired);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        message: `Successfully cleaned up ${expiredSessions.length} sessions.`,
        sessionsCleaned: expiredSessions.length,
        filesRemovedFromStorage: storageDeletedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Cleanup job error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
