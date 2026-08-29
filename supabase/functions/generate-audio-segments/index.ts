import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
// CLEAN
// -----------------------------
function clean(text: string, lang: string) {
  if (!text) return "";
  let t = text.replace(/\s+/g, " ").trim();

  if (lang === "en") t = t.replace(/[ऀ-ॿ]+/g, "");
  if (lang === "hi") t = t.replace(/[A-Za-z]+/g, "");

  return t;
}

// -----------------------------
// SPLIT
// -----------------------------
function split(text: string, max = 700) {
  const parts = text.split(".");
  const out: string[] = [];
  let cur = "";

  for (const p of parts) {
    if ((cur + p).length > max) {
      if (cur) out.push(cur);
      cur = p;
    } else {
      cur += p + ".";
    }
  }

  if (cur) out.push(cur);
  return out;
}

// -----------------------------
// SEGMENTS
// -----------------------------
function segments(type: string) {
  return type === "bhagavad_gita"
    ? [
        "intro_dynamic",
        "sanskrit",
        "main_text",
        "commentary",
        "daily_life_application",
        "practical_examples",
      ]
    : ["intro_dynamic", "main_text", "commentary", "daily_life_application"];
}

// -----------------------------
// FOLDER
// -----------------------------
function book(type: string) {
  if (type === "bhagavad_gita") return "gita";
  if (type === "ramayana") return "ramayan";
  if (type === "mahabharata") return "mahabharat";
  return "misc";
}

// -----------------------------
// PATH
// -----------------------------
function path(c: any, seg: string, g: string, i: number) {
  const b = book(c.content_type);
  const l = c.language === "hi" ? "hi" : "en";
  const gen = g === "male" ? "male" : "female";

  return `${b}/chapter-${c.chapter_no}/verse-${c.verse_no}/${l}/${gen}/${seg}_${i}.wav`;
}

// -----------------------------
// TEXT
// -----------------------------
function getText(c: any, seg: string) {
  switch (seg) {
    case "intro_dynamic":
      if (c.content_type === "bhagavad_gita") {
        return c.language === "en"
          ? `Welcome. We are in Chapter ${c.chapter_no}, Verse ${c.verse_no} of the Bhagavad Gita. Let us listen to the original verse and then understand its meaning.`
          : `हम भगवद गीता के अध्याय ${c.chapter_no}, श्लोक ${c.verse_no} में हैं। पहले श्लोक सुनते हैं और फिर उसका अर्थ समझते हैं।`;
      }
      if (c.content_type === "ramayana") {
        return c.language === "en"
          ? `Welcome. Let us begin today's Ramayan katha.`
          : `रामायण की आज की कथा में आपका स्वागत है।`;
      }
      return c.language === "en"
        ? `Welcome. Let us begin today's Mahabharat katha.`
        : `महाभारत की आज की कथा में आपका स्वागत है।`;

    case "sanskrit":
      return c.sanskrit;
    case "main_text":
      return c.main_text;
    case "commentary":
      return c.commentary;
    case "daily_life_application":
      return c.daily_life_application;
    case "practical_examples":
      return Array.isArray(c.practical_examples)
        ? c.practical_examples.join(" ")
        : c.practical_examples;

    default:
      return null;
  }
}

// -----------------------------
// GEMINI TTS (gemini-3.1-flash-tts-preview)
// -----------------------------
async function tts(text: string, voice: string) {
  const key = Deno.env.get("GEMINI_API_KEY");
  
  if (!key) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${key}`,
    {
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
    }
  );

  const raw = await res.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Gemini raw response:", raw);
    throw new Error("Invalid Gemini response - not valid JSON");
  }

  if (!res.ok) {
    console.error("Gemini error response:", data);
    throw new Error(data?.error?.message || `Gemini failed with status ${res.status}`);
  }

  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    console.error("Gemini response structure:", JSON.stringify(data, null, 2));
    throw new Error("No audio data in Gemini response");
  }

  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }

  return bytes;
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
    const body = await req.json();
    const { content_id, voice_gender } = body;
    
    console.log("Received request:", { content_id, voice_gender });
    
    if (!content_id || !voice_gender) {
      throw new Error("Missing required fields: content_id and voice_gender");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase environment variables not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching content from database...");
    
    const contentRes = await supabase
      .from("content_master")
      .select("*")
      .eq("id", content_id)
      .maybeSingle();

    if (contentRes.error) {
      console.error("Database error:", contentRes.error);
      throw new Error(`Database query failed: ${contentRes.error.message}`);
    }

    const c = contentRes.data;
    if (!c) {
      throw new Error(`Content not found for id: ${content_id}`);
    }

    console.log(`Processing: ${c.title || 'Untitled'} (${c.language}, ${voice_gender})`);

    const segs = segments(c.content_type);
    const out = [];

    for (const seg of segs) {
      try {
        console.log(`Processing segment: ${seg}`);
        
        const raw = getText(c, seg);
        if (!raw) {
          console.log(`Skipping ${seg} - no text`);
          continue;
        }

        const chunks = split(clean(raw, c.language));
        console.log(`${seg}: ${chunks.length} chunk(s)`);

        for (let i = 0; i < chunks.length; i++) {
          console.log(`  Generating chunk ${i + 1}/${chunks.length}...`);
          
          const pcm = await tts(
            chunks[i],
            voice_gender === "male" ? "Sadaltager" : "Sulafat"
          );

          const wav = pcmToWav(pcm);
          const p = path(c, seg, voice_gender, i);

          console.log(`  Uploading to: ${p}`);

          const uploadRes = await supabase.storage
            .from("audio-segments")
            .upload(p, wav, {
              contentType: "audio/wav",
              upsert: true,
            });

          if (uploadRes.error) {
            console.error("Upload error:", uploadRes.error);
            throw new Error(`Upload failed: ${uploadRes.error.message}`);
          }

          const { data: publicUrlData } = supabase.storage
            .from("audio-segments")
            .getPublicUrl(p);

          if (!publicUrlData?.publicUrl) {
            throw new Error("Failed to get public URL");
          }

          console.log(`  Saving to database...`);

          const upsertRes = await supabase
            .from("audio_segments")
            .upsert(
              {
                content_id,
                segment_type: seg,
                voice_gender,
                chunk_index: i,
                audio_url: publicUrlData.publicUrl,
                status: "completed",
              },
              {
                onConflict: "content_id,segment_type,voice_gender,chunk_index",
              }
            );

          if (upsertRes.error) {
            console.error("Database upsert error:", upsertRes.error);
            throw new Error(`Database upsert failed: ${upsertRes.error.message}`);
          }

          console.log(`  ✓ Chunk ${i + 1} completed`);
        }

        out.push({ segment: seg, status: "done", chunks: chunks.length });
        console.log(`✓ ${seg} completed`);
        
      } catch (err) {
        console.error(`✗ SEGMENT FAIL (${seg}):`, err);
        out.push({ segment: seg, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("FATAL ERROR:", e);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: e.message,
        stack: e.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});