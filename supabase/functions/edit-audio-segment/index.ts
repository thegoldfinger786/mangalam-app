import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// -----------------------------
// Helpers
// -----------------------------
function createHash(text: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return Array.from(data)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);
}

function buildTtsText(text: string): string {
  return `You are an Indian spiritual speaker. You are explaining teachings from sacred Indian texts like the Bhagavad Gita, Ramayan, and Mahabharat.

Speak in a calm, composed, warm, and devotional tone.
Maintain clarity and natural flow.
Pronounce Sanskrit and Indian names correctly.

${text}`;
}

function getVoiceConfig(language: string, gender: string, segmentType: string) {
  const voiceName = gender === "male" ? "Sadaltager" : "Sulafat";

  let speakingRate = 0.95;

  if (segmentType === "sanskrit") speakingRate = 0.85;
  if (segmentType.includes("intro") || segmentType.includes("outro")) speakingRate = 0.9;

  return {
    voiceName,
    speakingRate,
    languageCode: language === "hi" ? "hi-IN" : "en-IN",
  };
}

function buildStoragePath(content: any, segmentType: string, gender: string) {
  const contentTypeMap: Record<string, string> = {
    bhagavad_gita: "gita",
    ramayana: "ramayan",
    mahabharata: "mahabharat"
  };

  const base = contentTypeMap[content.content_type] || "misc";
  const lang = content.language === "hi" ? "hi" : "en";
  const genderFolder = gender === "male" ? "male" : "female";

  return `${base}/chapter-${content.chapter_no}/verse-${content.verse_no}/${lang}/${genderFolder}/${segmentType}.wav`;
}

const ALLOWED_SEGMENTS = [
  "intro_dynamic",
  "sanskrit",
  "main_text",
  "commentary",
  "daily_life_application",
  "practical_examples",
];

// -----------------------------
// Gemini TTS
// -----------------------------
async function generateAudioWithGemini(text: string, voiceConfig: any): Promise<Uint8Array> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-tts:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildTtsText(text) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: voiceConfig.languageCode,
            speakingRate: voiceConfig.speakingRate,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceConfig.voiceName,
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("No audio returned from Gemini");
  }

  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// -----------------------------
// Main Handler
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
    const { content_id, segment_type, voice_gender, text, language } = await req.json();

    if (!content_id || !segment_type || !voice_gender) {
      throw new Error("Missing required fields");
    }

    if (!ALLOWED_SEGMENTS.includes(segment_type)) {
      throw new Error(`Invalid segment_type: ${segment_type}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Always fetch minimal content for path + fallback
    const { data: content, error } = await supabase
      .from("content_master")
      .select("content_type, chapter_no, verse_no, language, sanskrit, main_text, commentary, daily_life_application, practical_examples")
      .eq("id", content_id)
      .single();

    if (error) throw error;

    let finalText = text;
    let finalLanguage = language || content.language;

    if (!finalText) {
      switch (segment_type) {
        case "sanskrit":
          finalText = content.sanskrit;
          break;
        case "main_text":
          finalText = content.main_text;
          break;
        case "commentary":
          finalText = content.commentary;
          break;
        case "daily_life_application":
          finalText = content.daily_life_application;
          break;
        case "practical_examples":
          finalText = Array.isArray(content.practical_examples)
            ? content.practical_examples.join(" ")
            : content.practical_examples;
          break;
      }
    }

    if (!finalText || finalText.trim() === "") {
      throw new Error("No text available");
    }

    const voiceConfig = getVoiceConfig(finalLanguage, voice_gender, segment_type);
    const textHash = createHash(finalText);

    console.log(`Generating: ${segment_type} (${voice_gender})`);

    await supabase.from("audio_segments").upsert({
      content_id,
      segment_type,
      voice_gender,
      text_hash: textHash,
      status: "processing",
      language: finalLanguage
    }, {
      onConflict: "content_id,segment_type,voice_gender"
    });

    const audioBuffer = await generateAudioWithGemini(finalText, voiceConfig);

    const fileName = buildStoragePath(content, segment_type, voice_gender);

    const { error: uploadError } = await supabase.storage
      .from("audio-segments")
      .upload(fileName, audioBuffer, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("audio-segments")
      .getPublicUrl(fileName);

    await supabase.from("audio_segments").upsert({
      content_id,
      segment_type,
      voice_gender,
      audio_url: publicUrl,
      text_hash: textHash,
      status: "completed",
      error_message: null,
      language: finalLanguage
    }, {
      onConflict: "content_id,segment_type,voice_gender"
    });

    return new Response(JSON.stringify({
      success: true,
      audio_url: publicUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});