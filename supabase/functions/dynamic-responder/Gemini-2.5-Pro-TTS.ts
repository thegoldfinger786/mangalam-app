import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { requireAdmin } from "../_shared/adminAuth.ts";

type Language = "en" | "hi";
type Gender = "male" | "female";

const FINAL_BUCKET = "audio-content";

const GEMINI_VOICES = {
  male: "Sadaltager",
  female: "Kore",
} as const;

function getVoice(gender: Gender) {
  return GEMINI_VOICES[gender] || "Sadaltager";
}

function cleanText(input: any): string {
  if (!input) return "";
  return String(input).trim();
}

function parseExamples(input: any): string[] {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return [input];
    }
  }
  return [];
}

function buildTranscript(paragraphs: string[]) {
  return paragraphs.join("\n[pause]\n");
}

function buildPrompt(text: string, gender: Gender) {
  return `
SYNTHESIZE SPEECH. DO NOT READ ANY INSTRUCTIONS ALOUD.

<AudioProfile>
Voice: ${gender}, calm narrator
</AudioProfile>

<Scene>
A calm and reflective spiritual environment
</Scene>

<DirectorNotes>
- Speak clearly
- Maintain steady pacing
- Add natural pauses
</DirectorNotes>

<Transcript>
${text}
</Transcript>
`;
}

function splitText(text: string, max = 2000): string[] {
  if (text.length <= max) return [text];

  const parts: string[] = [];
  let current = "";

  const sentences = text.split(/(?<=[.!?।])/);

  for (const s of sentences) {
    if ((current + s).length < max) {
      current += s;
    } else {
      parts.push(current);
      current = s;
    }
  }

  if (current) parts.push(current);
  return parts;
}

async function generateAudio(
  ai: GoogleGenAI,
  prompt: string,
  voice: string
): Promise<Uint8Array> {

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      if (!res || !res.candidates || res.candidates.length === 0) {
        throw new Error("No candidates returned from Gemini");
      }

      const part = res.candidates[0]?.content?.parts?.[0];

      if (!part || !part.inlineData?.data) {
        throw new Error("No audio data returned from Gemini");
      }

      return Uint8Array.from(atob(part.inlineData.data), (c) =>
        c.charCodeAt(0)
      );

    } catch (err) {
      console.log(`TTS attempt ${attempt} failed`, err);

      if (attempt === 2) throw err;

      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error("TTS failed after retries");
}

serve(async (req) => {
  // Authorization before any body parsing, Gemini call, service-role
  // operation or storage write. Shared mechanism: _shared/adminAuth.ts
  // Placed outside the try so a denial cannot be swallowed into a 500.
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    console.log("START");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ai = new GoogleGenAI({
      apiKey: Deno.env.get("TTS_API_KEY"),
    });

    const body = await req.json();

    const verseId = body.verse_id;
    const language = body.language as Language;
    const gender = body.gender as Gender;

    if (!verseId || !language || !gender) {
      throw new Error("Missing input");
    }

    // 🔎 SAFE DB FETCH
    const res = await supabase
      .from("verse_content")
      .select(`
        *,
        verses (
          book_id,
          chapter_no,
          verse_no,
          sanskrit,
          books (slug)
        )
      `)
      .eq("verse_id", verseId)
      .eq("language", language)
      .single();

    if (!res) throw new Error("No response from DB");
    if (res.error) throw new Error(res.error.message);

    const content = res.data;

    if (!content || !content.verses) {
      throw new Error("Invalid content structure");
    }

    console.log("FETCH OK");

    // 🧠 Build narration
    const paragraphs = [
      cleanText(content.verses.sanskrit),
      cleanText(content.translation),
      cleanText(content.commentary),
      cleanText(content.daily_life_application),
      ...parseExamples(content.practical_examples),
    ].filter(Boolean);

    const transcript = buildTranscript(paragraphs);
    const chunks = splitText(transcript);

    const voice = getVoice(gender);

    const buffers: Uint8Array[] = [];

    for (const chunk of chunks) {
      const prompt = buildPrompt(chunk, gender);
      const audio = await generateAudio(ai, prompt, voice);
      buffers.push(audio);
    }

    // 🔗 Merge audio
    const total = buffers.reduce((sum, b) => sum + b.length, 0);
    const merged = new Uint8Array(total);

    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.length;
    }

    const slug = content.verses.books.slug;
    const path = `${slug}/chapter-${content.verses.chapter_no}/verse-${content.verses.verse_no}/${language}/voice-${gender}.mp3`;

    // 📦 Upload
    const uploadRes = await supabase.storage
      .from(FINAL_BUCKET)
      .upload(path, merged, {
        upsert: true,
        contentType: "audio/mpeg",
      });

    if (!uploadRes) throw new Error("No upload response");
    if (uploadRes.error) throw new Error(uploadRes.error.message);

    // 🗄 DB update
    const dbRes = await supabase.from("verse_audio").upsert({
  book_id: content.verses.book_id,
  verse_id: verseId,
  language: language,
  section: "full_narrative",
  voice_id: voice, // "Sadaltager" or "Kore"
  storage_path: path,
  storage_bucket: "audio-content",
  asset_type: "compiled_full_episode",
  status: "ready",
  is_canonical: true,
  is_primary_playback: true
}, {
  onConflict: "book_id,verse_id,language,section,voice_id,asset_type"
});

if (dbRes.error) {
  console.error("DB INSERT FAILED:", dbRes.error);
  throw new Error(dbRes.error.message);
}

    return new Response(JSON.stringify({ success: true, path }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});