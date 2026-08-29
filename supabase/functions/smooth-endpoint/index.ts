import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const VOICE_MAP: Record<string, string> = {
  en: "en-IN-Neural2-B",
  hi: "hi-IN-Neural2-A",
};

// =========================
// PRONUNCIATION MAP
// =========================
const EN_PRONUNCIATION: Record<string, string> = {
  Ram: "Raam",
  Sita: "Seeta",
  Lakshman: "Lakshman",
  Hanuman: "Hanumaan",
  Raavan: "Raavan",
  Ayodhya: "Ayodhyaa",
  Bharat: "Bha-rath",
  Yagn: "Yag-ya",
};

// =========================
// TEXT CLEANING
// =========================
function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =========================
// XML ESCAPE (CRITICAL)
// =========================
function escapeXML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =========================
// ENGLISH FIXES
// =========================
function fixEnglish(text: string) {
  let out = text;

  out = out.replace(/\b(\w+)'s\b/g, "$1 s");

  for (const [key, val] of Object.entries(EN_PRONUNCIATION)) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    out = out.replace(regex, val);
  }

  return out;
}

// =========================
// HINDI FIXES
// =========================
function fixHindi(text: string) {
  let out = text;

  out = out.replace(/(है|हैं|हूँ|था|थे|थी)([^ ा-ौ\s,.!?;:।॥])/g, "$1 $2");
  out = out.replace(/\b(है|हैं|था|थे|थी)\b/g, "$1 <break time=\"120ms\"/>");

  return out;
}

// =========================
// NORMALIZATION
// =========================
function normalize(text: string, lang: string) {
  let out = cleanText(text);
  out = lang === "en" ? fixEnglish(out) : fixHindi(out);
  return escapeXML(out); // 👈 critical
}

// =========================
// PAUSES
// =========================
function addPauses(text: string, lang: string) {
  if (lang === "hi") {
    text = text.replace(/([।॥])\s+/g, `$1 <break time="350ms"/> `);
  } else {
    text = text.replace(/([.!?])\s+/g, `$1 <break time="300ms"/> `);
  }

  text = text.replace(/([,;:])\s+/g, `$1 <break time="120ms"/> `);

  text = text.replace(
    /\s+(However|But|Then|Suddenly|Meanwhile)\s+/g,
    ` <break time="200ms"/> $1 `
  );

  return text;
}

// =========================
// SSML BUILDER
// =========================
function buildSSML(text: string, lang: string) {
  const paragraphs = normalize(text, lang)
    .split(/\n{2,}/)
    .filter(Boolean);

  const wrapped = paragraphs
    .map(p => `<p>${addPauses(p, lang)}</p>`)
    .join("");

  const langCode = lang === "hi" ? "hi-IN" : "en-IN";

  return `<speak><lang xml:lang="${langCode}">${wrapped}</lang></speak>`;
}

// =========================
// BYTE LENGTH
// =========================
function byteLength(str: string) {
  return new TextEncoder().encode(str).length;
}

// =========================
// LARGE PARAGRAPH SPLIT
// =========================
function splitLargeParagraph(paragraph: string) {
  const inner = paragraph.replace(/^<p>|<\/p>$/g, "");
  const sentences = inner.split(/(?<=[.!?।॥])\s+/);

  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const candidate = `<speak><p>${current + s}</p></speak>`;

    if (byteLength(candidate) < 4800) {
      current += s + " ";
    } else {
      if (current) {
        chunks.push(`<speak><p>${current.trim()}</p></speak>`);
      }
      current = s + " ";
    }
  }

  if (current) {
    chunks.push(`<speak><p>${current.trim()}</p></speak>`);
  }

  return chunks;
}

// =========================
// SSML SPLIT
// =========================
function splitSSML(ssml: string) {
  const body = ssml.match(/<speak>([\s\S]*)<\/speak>/)?.[1] ?? ssml;
  const paragraphs = [...body.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m => m[0]);

  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    const candidate = `<speak>${current + p}</speak>`;

    if (byteLength(candidate) < 4800) {
      current += p;
    } else {
      if (current) {
        chunks.push(`<speak>${current}</speak>`);
      }

      current = p;

      if (byteLength(`<speak>${current}</speak>`) > 4800) {
        chunks.push(...splitLargeParagraph(current));
        current = "";
      }
    }
  }

  if (current) {
    chunks.push(`<speak>${current}</speak>`);
  }

  return chunks;
}

// =========================
// TTS CALL
// =========================
async function generateTTS(ssml: string, voice: string, apiKey: string) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml },
        voice: {
          languageCode: voice.includes("hi") ? "hi-IN" : "en-IN",
          name: voice,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: voice.includes("hi") ? 0.75 : 0.78,
        },
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.audioContent) {
    throw new Error("TTS failed: " + JSON.stringify(json));
  }

  return Uint8Array.from(atob(json.audioContent), c => c.charCodeAt(0));
}

// =========================
// MAIN SERVER
// =========================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authorization before any body parsing, vendor API call, service-role
  // operation or storage write. Shared mechanism: _shared/adminAuth.ts
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { text, language } = await req.json();

    if (!text || !language) {
      throw new Error("Missing text or language");
    }

    const apiKey = Deno.env.get("TTS_API_KEY");
    if (!apiKey) {
      throw new Error("Missing TTS_API_KEY");
    }

    const voice = VOICE_MAP[language];
    if (!voice) {
      throw new Error("Unsupported language");
    }

    const ssml = buildSSML(text, language);
    const chunks = splitSSML(ssml);

    const audioParts: Uint8Array[] = [];

    for (const chunk of chunks) {
      audioParts.push(await generateTTS(chunk, voice, apiKey));
    }

    const total = audioParts.reduce((s, a) => s + a.length, 0);
    const merged = new Uint8Array(total);

    let offset = 0;
    for (const a of audioParts) {
      merged.set(a, offset);
      offset += a.length;
    }

    return new Response(merged, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...corsHeaders,
      },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});