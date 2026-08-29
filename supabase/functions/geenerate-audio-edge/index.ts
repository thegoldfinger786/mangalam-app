/**
 * EDGE FUNCTION: Bulk TTS Generator Orchestrator
 *
 * What this function does:
 * -----------------------
 * This function acts as a controller/orchestrator that:
 * 1. Fetches verses from the "verses" table based on filters
 * 2. Calls another edge function (`generate-tts-new`) for each verse
 * 3. Generates audio in multiple combinations:
 *    - Languages (English / Hindi)
 *    - Genders (Male / Female)
 * 4. Returns a detailed result of all TTS generation calls
 *
 *
 * Why this exists:
 * ----------------
 * Instead of calling TTS generation one-by-one manually,
 * this function automates bulk generation across:
 *   verses × languages × genders
 *
 * Useful for:
 * - Podcast generation pipelines
 * - Batch audio creation
 * - Regeneration (via `force = true`)
 *
 *
 * Input (POST body):
 * ------------------
 * {
 *   book_id: string (required)
 *   chapter_no?: number (optional)
 *   verse_no?: number (optional, requires chapter_no)
 *   force?: boolean (default: false)
 *   languages?: ["en", "hi"] (default: both)
 *   genders?: ["male", "female"] (default: both)
 * }
 *
 *
 * How filtering works:
 * --------------------
 * - book_id → required
 * - chapter_no → optional filter
 * - verse_no → optional (only valid WITH chapter_no)
 *
 * Examples:
 * - Whole book → only book_id
 * - One chapter → book_id + chapter_no
 * - Single verse → book_id + chapter_no + verse_no
 *
 *
 * Core flow:
 * ----------
 * 1. Validate input
 * 2. Fetch matching verses from DB
 * 3. Loop:
 *      for each verse
 *        for each language
 *          for each gender
 *            call generate-tts-new
 * 4. Collect all responses
 * 5. Return summary + detailed results
 *
 *
 * Key behavior:
 * -------------
 * - Sequential execution (safe but slower)
 * - Calls internal Supabase Edge Function securely
 * - Uses SERVICE ROLE (full DB + function access)
 *
 *
 * Force flag:
 * -----------
 * force = true  → regenerate audio even if it exists
 * force = false → skip if already generated (handled in downstream function)
 *
 *
 * Output:
 * -------
 * {
 *   success: boolean,
 *   verses_found: number,
 *   total_calls: number,
 *   results: [
 *     {
 *       verse_id,
 *       chapter_no,
 *       verse_no,
 *       language,
 *       gender,
 *       ok,
 *       status_code,
 *       response
 *     }
 *   ]
 * }
 *
 *
 * Important dependencies:
 * -----------------------
 * - "verses" table (source of truth)
 * - `generate-tts-new` edge function (actual TTS generator)
 *
 *
 * Mental model:
 * -------------
 * This function = "Batch Manager"
 * generate-tts-new = "Worker"
 *
 * Manager decides WHAT to generate
 * Worker actually generates audio
 *
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Server-side only. Used to authorize this function's internal call to
// generate-tts-new. Never read from the request, never logged, never returned.
const ADMIN_API_SECRET = Deno.env.get("ADMIN_API_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type RequestBody = {
  book_id: string;
  chapter_no?: number;
  verse_no?: number;
  force?: boolean;
  languages?: Array<"en" | "hi">;
  genders?: Array<"male" | "female">;
};

type VerseRow = {
  verse_id: string;
  book_id: string;
  chapter_no: number | null;
  verse_no: number | null;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { message: String(error) };
  }
}

async function callGenerateTtsNew(params: {
  verse_id: string;
  language: "en" | "hi";
  gender: "male" | "female";
  force: boolean;
}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-tts-new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      // generate-tts-new now requires operator authorization. Forwarded from
      // this function's own server-side environment — never from the request.
      "x-admin-secret": ADMIN_API_SECRET,
    },
    body: JSON.stringify({
      verse_id: params.verse_id,
      language: params.language,
      gender: params.gender,
      force: params.force,
    }),
  });

  const rawText = await response.text();

  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = { raw: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
  };
}

Deno.serve(async (req) => {
  // Authorization before any body parsing, service-role operation, or call
  // out to generate-tts-new. Shared mechanism: _shared/adminAuth.ts
  // Placed outside the try so a denial cannot be swallowed into a 500.
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body: RequestBody = await req.json();

    if (!body.book_id) {
      return jsonResponse({ error: "book_id is required" }, 400);
    }

    if (body.verse_no !== undefined && body.chapter_no === undefined) {
      return jsonResponse(
        { error: "chapter_no is required when verse_no is provided" },
        400,
      );
    }

    const force = body.force ?? false;
    const languages = body.languages?.length ? body.languages : ["en", "hi"];
    const genders = body.genders?.length ? body.genders : ["male", "female"];

    let query = supabase
      .from("verses")
      .select("verse_id, book_id, chapter_no, verse_no")
      .eq("book_id", body.book_id);

    if (body.chapter_no !== undefined) {
      query = query.eq("chapter_no", body.chapter_no);
    }

    if (body.verse_no !== undefined) {
      query = query.eq("verse_no", body.verse_no);
    }

    query = query
      .order("chapter_no", { ascending: true })
      .order("verse_no", { ascending: true });

    const { data: verses, error } = await query;

    if (error) {
      return jsonResponse({
        success: false,
        stage: "fetch_verses",
        input_received: body,
        error: normalizeError(error),
      }, 500);
    }

    if (!verses || verses.length === 0) {
      return jsonResponse({
        success: false,
        stage: "fetch_verses",
        message: "No matching verses found",
        input_received: body,
      }, 404);
    }

    const results = [];

    for (const verse of verses as VerseRow[]) {
      for (const language of languages) {
        for (const gender of genders) {
          const ttsResult = await callGenerateTtsNew({
            verse_id: verse.verse_id,
            language,
            gender,
            force,
          });

          results.push({
            verse_id: verse.verse_id,
            chapter_no: verse.chapter_no,
            verse_no: verse.verse_no,
            language,
            gender,
            ok: ttsResult.ok,
            status_code: ttsResult.status,
            response: ttsResult.body,
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      verses_found: verses.length,
      total_calls: verses.length * languages.length * genders.length,
      results,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      stage: "top_level",
      error: normalizeError(error),
    }, 500);
  }
});