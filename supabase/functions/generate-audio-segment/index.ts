import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TARGET_BYTES = 4500;
const SYSTEM_INSTRUCTION = `Scene: You are an Indian Spiritual Speaker giving a calm spiritual narration of an ancient Indian scripture, spoken in a peaceful and devotional setting.

Context: The speaker is explaining a sacred verse with clarity and warmth, like a knowledgeable teacher guiding the listener gently.`;

// -----------------------------
// BYTE LENGTH
// -----------------------------
const byteLength = (t: string) =>
  new TextEncoder().encode(t).length;

// -----------------------------
// CHUNKING
// -----------------------------
function chunkText(text: string): string[] {
  if (byteLength(text) <= TARGET_BYTES) return [text];

  const sentences = text.split(/(?<=[.?!।])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const test = current ? current + " " + s : s;

    if (byteLength(test) <= TARGET_BYTES) {
      current = test;
    } else {
      if (current) chunks.push(current);

      if (byteLength(s) > TARGET_BYTES) {
        const words = s.split(" ");
        let temp = "";

        for (const w of words) {
          const t = temp ? temp + " " + w : w;

          if (byteLength(t) <= TARGET_BYTES) {
            temp = t;
          } else {
            if (temp) chunks.push(temp);
            temp = w;
          }
        }

        if (temp) current = temp;
      } else {
        current = s;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// -----------------------------
// PCM → WAV
// -----------------------------
function pcmToWav(pcm: Uint8Array, rate = 24000) {
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);

  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(o + i, s.charCodeAt(i));
    }
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);

  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

// -----------------------------
// BOOK FROM DB
// -----------------------------
async function getBookFolder(supabase: any, book_id: string) {
  try {
    const result = await supabase
      .from("books")
      .select("name")
      .eq("book_id", book_id)
      .single();

    // Handle all possible response formats
    const data = result?.data || result;
    
    if (!data || !data.name) {
      console.log("No book data found, using misc");
      return "misc";
    }

    const name = data.name;

    if (name === "bhagavad_gita") return "gita";
    if (name === "ramayana") return "ramayan";
    if (name === "mahabharata") return "mahabharat";

    return "misc";
  } catch (err: any) {
    console.error("getBookFolder error:", err?.message || err);
    return "misc";
  }
}

// -----------------------------
// PATH
// -----------------------------
function buildPath(c: any, folder: string, seg: string, gender: string, i: number) {
  const lang = c.language === "hi" ? "hi" : "en";
  const g = gender === "male" ? "male" : "female";

  return `${folder}/chapter-${c.chapter_no}/verse-${c.verse_no}/${lang}/${g}/${seg}_${i}.wav`;
}

// -----------------------------
// TEXT
// -----------------------------
function getText(c: any, seg: string) {
  return c[seg] || null;
}

// -----------------------------
// PROMPT
// -----------------------------
function buildPrompt(text: string) {
  return `${SYSTEM_INSTRUCTION}

Now speak the following:

${text}`;
}

// -----------------------------
// GEMINI TTS
// -----------------------------
async function tts(text: string, voice: string) {
  try {
    const key = Deno.env.get("GEMINI_API_KEY");

    if (!key) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${key}`;

    console.log(`Calling Gemini TTS with ${byteLength(text)} bytes, voice: ${voice}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    console.log("Gemini response keys:", Object.keys(data));

    const base64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64) {
      throw new Error(`No audio in response: ${JSON.stringify(data).substring(0, 500)}`);
    }

    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);

    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    console.log(`Generated ${bytes.length} bytes of audio`);
    return bytes;

  } catch (err: any) {
    console.error("TTS error:", err?.message || err);
    throw err;
  }
}

// -----------------------------
// MAIN
// -----------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authorization before any body parsing, vendor API call, service-role
  // operation or storage write. Shared mechanism: _shared/adminAuth.ts
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    console.log("=== Request started ===");
    
    const body = await req.json();
    const { content_id, voice_gender } = body;

    console.log("Request body:", { content_id, voice_gender });

    if (!content_id || !voice_gender) {
      throw new Error("Missing content_id or voice_gender");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch content - handle multiple response formats
    console.log("Fetching content...");
    const contentResult = await supabase
      .from("content_master")
      .select("*")
      .eq("id", content_id)
      .single();

    console.log("Content result keys:", Object.keys(contentResult || {}));

    // Try different response structures
    let contentData = null;
    if (contentResult?.data) {
      contentData = contentResult.data;
    } else if (contentResult && !contentResult.error) {
      contentData = contentResult;
    }

    if (!contentData) {
      const errorMsg = contentResult?.error?.message || "Content not found";
      throw new Error(`Content fetch failed: ${errorMsg}`);
    }

    const c = contentData;
    console.log("Content loaded:", { 
      id: c.id, 
      book_id: c.book_id,
      chapter: c.chapter_no,
      verse: c.verse_no,
      language: c.language 
    });

    const folder = await getBookFolder(supabase, c.book_id);
    console.log("Using folder:", folder);

    const segments = [
      "intro_dynamic",
      "sanskrit",
      "main_text",
      "commentary",
      "daily_life_application",
      "practical_examples",
    ];

    const results = [];

    for (const seg of segments) {
      try {
        const raw = getText(c, seg);
        if (!raw) {
          console.log(`⊘ Skipping ${seg} - no content`);
          continue;
        }

        console.log(`▶ Processing ${seg} (${raw.length} chars)`);

        const chunks = chunkText(raw);
        console.log(`  Split into ${chunks.length} chunk(s)`);

        for (let i = 0; i < chunks.length; i++) {
          console.log(`  [${i + 1}/${chunks.length}] Generating audio...`);
          
          const prompt = buildPrompt(chunks[i]);
          const voice = voice_gender === "male" ? "Sadaltager" : "Sulafat";
          
          const pcm = await tts(prompt, voice);
          const wav = pcmToWav(pcm);
          const filePath = buildPath(c, folder, seg, voice_gender, i);

          console.log(`  Uploading to: ${filePath}`);

          // Upload - handle different response structures
          const uploadResult = await supabase.storage
            .from("audio-segments")
            .upload(filePath, wav, {
              contentType: "audio/wav",
              upsert: true,
            });

          console.log("  Upload result keys:", Object.keys(uploadResult || {}));

          // Check for error in any format
          if (uploadResult?.error) {
            throw new Error(`Upload failed: ${uploadResult.error.message}`);
          }

          // Get public URL
          const urlResult = supabase.storage
            .from("audio-segments")
            .getPublicUrl(filePath);

          const publicUrl = urlResult?.data?.publicUrl || urlResult?.publicUrl;

          if (!publicUrl) {
            throw new Error(`No public URL returned for ${filePath}`);
          }

          console.log(`  ✓ Uploaded: ${publicUrl.substring(0, 80)}...`);

          // Save to database
          const dbResult = await supabase
            .from("audio_segments")
            .upsert(
              {
                content_id,
                segment_type: seg,
                voice_gender,
                chunk_index: i,
                audio_url: publicUrl,
                status: "completed",
              },
              {
                onConflict: "content_id,segment_type,voice_gender,chunk_index",
              }
            );

          console.log("  DB result keys:", Object.keys(dbResult || {}));

          if (dbResult?.error) {
            throw new Error(`DB insert failed: ${dbResult.error.message}`);
          }

          console.log(`  ✓ DB record saved`);
        }

        results.push({ 
          segment: seg, 
          status: "done", 
          chunks: chunks.length 
        });
        console.log(`✓ ${seg} complete`);

      } catch (err: any) {
        console.error(`✗ Error in ${seg}:`, err?.message || err);
        results.push({ 
          segment: seg, 
          status: "failed", 
          error: err?.message || String(err)
        });
      }
    }

    console.log("=== Request complete ===");
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("=== FATAL ERROR ===");
    console.error("Error type:", typeof err);
    console.error("Error keys:", err ? Object.keys(err) : "null");
    console.error("Error message:", err?.message);
    console.error("Error stack:", err?.stack);
    console.error("Full error:", JSON.stringify(err, null, 2));
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err?.message || String(err),
        errorType: typeof err,
        errorDetails: err ? Object.keys(err) : []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});