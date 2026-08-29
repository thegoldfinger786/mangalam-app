import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PARALLEL = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authorization before any body parsing, vendor API call, service-role
  // operation or storage write. Shared mechanism: _shared/adminAuth.ts
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const {
      batch_size = 10,
      content_type = null,
      language = null,
      chapter_no = null,
      mode = "normal", // "normal" | "retry_failed"
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // -----------------------------
    // STEP 1: FETCH ROWS
    // -----------------------------
    let query = supabase
      .from("content_master")
      .select(
        "id, title, content_type, language, chapter_no, verse_no, voice_status"
      )
      .limit(batch_size);

    if (mode === "retry_failed") {
      query = query.eq("status", "failed");
    } else {
      query = query.eq("status", "ready");
    }

    if (content_type) query = query.eq("content_type", content_type);
    if (language) query = query.eq("language", language);
    if (chapter_no) query = query.eq("chapter_no", chapter_no);

    const { data: contents, error } = await query;

    if (error) throw error;
    if (!contents.length) {
      return new Response(JSON.stringify({ message: "No content found" }), {
        headers: corsHeaders,
      });
    }

    const ids = contents.map((c) => c.id);

    // -----------------------------
    // STEP 2: LOCK ROWS
    // -----------------------------
    await supabase
      .from("content_master")
      .update({ status: "processing" })
      .in("id", ids);

    const FUNCTION_URL = `${Deno.env.get(
      "SUPABASE_URL"
    )}/functions/v1/generate-audio-segments`;

    const results = [];

    // -----------------------------
    // STEP 3: PROCESS IN PARALLEL
    // -----------------------------
    for (let i = 0; i < contents.length; i += MAX_PARALLEL) {
      const batch = contents.slice(i, i + MAX_PARALLEL);

      const promises = batch.map(async (content) => {
        try {
          const voiceResults: any = {
            male: false,
            female: false,
          };

          for (const gender of ["male", "female"]) {
            try {
              const res = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get(
                    "SUPABASE_SERVICE_ROLE_KEY"
                  )}`,
                  // generate-audio-segments now requires operator
                  // authorization. Forwarded from this function's own
                  // server-side environment — never from the request.
                  "x-admin-secret": Deno.env.get("ADMIN_API_SECRET") ?? "",
                },
                body: JSON.stringify({
                  content_id: content.id,
                  voice_gender: gender,
                }),
              });

              const json = await res.json();

              if (json.success) {
                voiceResults[gender] = true;
              }
            } catch (err) {
              console.error(
                `Voice error (${gender}) for ${content.id}`,
                err.message
              );
            }

            await new Promise((r) => setTimeout(r, 500));
          }

          // -----------------------------
          // STEP 4: UPDATE STATUS
          // -----------------------------
          const allDone =
            voiceResults.male === true && voiceResults.female === true;

          await supabase
            .from("content_master")
            .update({
              status: allDone ? "completed" : "partial",
              voice_status: voiceResults,
            })
            .eq("id", content.id);

          return {
            content_id: content.id,
            success: allDone,
            voiceResults,
          };
        } catch (err) {
          console.error(`Content error ${content.id}`, err.message);

          await supabase
            .from("content_master")
            .update({ status: "failed" })
            .eq("id", content.id);

          return {
            content_id: content.id,
            success: false,
            error: err.message,
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    // -----------------------------
    // SUMMARY
    // -----------------------------
    const summary = {
      total: contents.length,
      completed: results.filter((r) => r.success).length,
      partial: results.filter((r) => !r.success && r.voiceResults).length,
      failed: results.filter((r) => !r.success && !r.voiceResults).length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});