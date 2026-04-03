import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PRONUNCIATION_ATLAS: Record<string, string> = {
    'Sumitra': 'Sumitraa',
    'Vishwamitr': 'Vishwamitra',
    'Vashishth': 'Vashishthaa',
    'Dashrath': 'Dashrath',
    'Yagn': 'Yag-ya',
    'Yagna': 'Yag-ya',
    'Bharat': 'Bharatha',
    'Shatrughan': 'Shatrughna',
    'Janak': 'Janaka',
    'Raavan': 'Raavana',
    'Ikshvaku': 'Ikshvaaku',
    'Ayodhya': 'Ayodhyaa',
    'Mithila': 'Mithilaa',
    'Rishyashring': 'Rishyashringa',
    'Yagnpurush': 'Yagya purush',
    'Ashwamedh': 'Ashvamedha',
    'Putrakameshti': 'Putra kaameshti',
    'Satyavati': 'Satyavatee',
    'Mahabharat': 'Mahaabhaarat',
    'Hastinapur': 'Hastinaapuraa',
    'Kurukshetra': 'Kurukshetra',
    'Pandava': 'Paandava',
    'Kaurava': 'Kauravaa',
    'Yudhishthira': 'Yudhishthiraa',
    'Bhima': 'Bheemaa',
    'Arjuna': 'Arjunaa',
    'Nakula': 'Nakulaa',
    'Sahadeva': 'Sahaadeva',
    'Draupadi': 'Droupadee',
    'Kunti': 'Kuntee',
    'Gandhari': 'Gaandhaaree',
    'Dhritarashtra': 'Dhrutaraashtra',
    'Pandu': 'Paandu',
    'Bhishma': 'Bheeshmaa',
    'Drona': 'Drohnaa',
    'Vidura': 'Viduraa',
    'Karna': 'Karnaa',
    'Satyajit': 'Satyajeet',
    'Janamejaya': 'Janame-jaya',
    'Vyasa': 'Vyaasa',
    'Vaisampayana': 'Vaishampayaana',
    'Sauti': 'Sautee',
    'Naimisharanya': 'Naimishaaranya',
    'Saunaka': 'Shaunakaa',
    'Lomaharshana': 'Lomaharshanaa',
    'Shaunaka': 'Shaunakaa',
    'Naimisha': 'Naimishaa',
    'Parashurama': 'Parashuraama',
    'Akshauhini': 'Akshauhinee',
    'Panchala': 'Panchaala',
    'Drupada': 'Dhrupadaa',
    'Swayamvara': 'Swayamvaraa',
    'Ashram': 'Aashram',
    'Yayati': 'Yayaatee',
    'Puru': 'Puruu',
    'Dushmanta': 'Dushmantaa',
    'Shakuntala': 'Shakuntalaa',
    'Bharatavarsha': 'Bharata-varsha',
    'Brahmin': 'Braahmin',
    'Kshatriya': 'Kshatreeya',
    'Dharma': 'Dharmaa',
    'Adharma': 'Adharmaa',
    'Karma': 'Karmaa',
};

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c] || c));
}

function processToSsml(text: string, language: string): string {
    if (!text) return '<speak></speak>';
    
    let processed = text
        .replace(/\*\*/g, '')          
        .replace(/[’‘]/g, "'")         
        .replace(/[“”]/g, '"')         
        .replace(/[\u200B-\u200D\uFEFF]/g, ''); 

    // Protect valid SSML
    processed = processed.replace(/<break([^>]+)>/g, "[[BREAK$1]]").replace(/<\/break>/g, "[[/BREAK]]");
    processed = processed.replace(/<emphasis([^>]+)>/g, "[[EMPHASIS$1]]").replace(/<\/emphasis>/g, "[[/EMPHASIS]]");

    processed = escapeXml(processed);

    processed = processed.replace(/\[\[BREAK([^\]]+)\]\]/g, "<break$1>").replace(/\[\[\/BREAK\]\]/g, "</break>");
    processed = processed.replace(/\[\[EMPHASIS([^\]]+)\]\]/g, "<emphasis$1>").replace(/\[\[\/EMPHASIS\]\]/g, "</emphasis>");

    if (language === 'en') {
        const sortedKeys = Object.keys(PRONUNCIATION_ATLAS).sort((a, b) => b.length - a.length);
        for (const word of sortedKeys) {
            const alias = PRONUNCIATION_ATLAS[word];
            const regex = new RegExp(`\\b${word}(?:'s|s)?\\b`, 'gi');
            processed = processed.replace(regex, (match) => {
                if (match.toLowerCase().endsWith("'s")) return `<sub alias="${alias}'s">${match}</sub>`;
                return `<sub alias="${alias}">${match}</sub>`;
            });
        }
        
        // Possessive workarounds
        processed = processed.replace(/\b(Ram|Sita|Hanuman|Lakshman|Arjun|Krishna|Karna|Pandu|Kunti|Drona|Bhishma)'s\b/gi, "$1 s");
    } else if (language === 'hi') {
        processed = processed.replace(/(हैं|है|हूँ|था|थे)([^ा-ौ\s,.!?;:<])/g, "$1 $2");
    }

    return `<speak>${processed}</speak>`;
}

const VOICE_CONFIGS = {
  en: { male: 'en-IN-Neural2-B', female: 'en-IN-Neural2-A' },
  hi: { male: 'hi-IN-Neural2-B', female: 'hi-IN-Neural2-A' },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateSingleTTS(ssml: string, voiceId: string, language: string, apiKey: string): Promise<Uint8Array> {
    const languageCode = language === 'en' ? 'en-IN' : 'hi-IN';
    const ttsUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + apiKey;
    
    const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { ssml },
            voice: { name: voiceId, languageCode },
            audioConfig: { audioEncoding: 'MP3' }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google TTS Error: ${errText}`);
    }

    const data = await response.json();
    const binaryString = atob(data.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function generateChunkedTTS(ssml: string, voiceId: string, language: string, apiKey: string): Promise<Uint8Array> {
    const speakContent = ssml.match(/<speak>([\s\S]*)<\/speak>/)?.[1] || ssml;
    const segments = speakContent.split(/(?<=<\/p>|।|\||\.|\n)/g);
    
    const chunks: string[] = [];
    let currentChunk = "";
    const LIMIT = language === 'hi' ? 1200 : 3500;

    for (const segment of segments) {
        if ((currentChunk.length + segment.length) > LIMIT) {
            if (currentChunk.trim()) chunks.push(`<speak>${currentChunk}</speak>`);
            currentChunk = segment;
            while (currentChunk.length > LIMIT) {
                const sub = currentChunk.substring(0, LIMIT);
                chunks.push(`<speak>${sub}</speak>`);
                currentChunk = currentChunk.substring(LIMIT);
            }
        } else {
            currentChunk += segment;
        }
    }
    if (currentChunk.trim()) chunks.push(`<speak>${currentChunk}</speak>`);

    const audioBuffers: Uint8Array[] = [];
    for (const chunk of chunks) {
        audioBuffers.push(await generateSingleTTS(chunk, voiceId, language, apiKey));
    }

    const totalLength = audioBuffers.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of audioBuffers) {
        result.set(buffer, offset);
        offset += buffer.length;
    }
    return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const ttsApiKey = Deno.env.get('TTS_API_KEY') || '';

  if (!supabaseUrl || !serviceRoleKey || !ttsApiKey) {
    return new Response(JSON.stringify({ error: "Missing required environment variables." }), { status: 500, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Default block scope to allow clean error handling and `status = 'failed'` state
  let bookId = '';
  let finalVerseId = '';
  let language = '';
  let assetType = '';
  let voiceId = '';
  let section = 'full_narrative';

  try {
    const body = await req.json();
    const { verse_id: verseId, language: reqLang, gender, force = false } = body;
    if (!verseId || !reqLang || !gender) throw new Error('Missing verse_id, language, or gender');

    finalVerseId = verseId;
    language = reqLang;
    voiceId = VOICE_CONFIGS[language as keyof typeof VOICE_CONFIGS][gender as 'male' | 'female'];

    // 1. Fetch content from verse_content + verses + books
    const { data: content, error: contentError } = await supabaseAdmin
      .from('verse_content')
      .select('*, verses(*, books(slug))')
      .eq('verse_id', verseId)
      .eq('language', language)
      .single();
    
    if (contentError) throw contentError;

    const bookSlug = content.verses.books.slug.toLowerCase();
    bookId = content.verses.book_id;
    const verseNo = content.verses.verse_no;
    const chapterNo = content.verses.chapter_no;
    const sanskrit = content.verses.sanskrit || '';
    const examples = Array.isArray(content.practical_examples) ? content.practical_examples : [];

    // 2. Determine book_slug, asset_type, storage_bucket, storage_path
    const isGita = bookSlug.includes('gita');
    const isRamayanOrMahabharat = bookSlug.includes('ramayan') || bookSlug.includes('mahabharat');
    
    // Rule: Book-level product rules
    const storageBucket = isGita ? 'audio-content' : 'verse-audio';
    assetType = isGita ? 'compiled_full_episode' : 'spoken_episode';
    const storagePath = `${bookSlug}/chapter-${chapterNo}/verse-${verseNo}/${language}/${assetType}/${voiceId}.mp3`;

    // 3. Cache Check (using verse_audio, NOT audio_cache)
    const { data: existingAudio } = await supabaseAdmin
      .from('verse_audio')
      .select('updated_at, storage_path, status, storage_bucket')
      .match({ 
        book_id: bookId, 
        verse_id: verseId, 
        language, 
        asset_type: assetType, 
        voice_id: voiceId 
      })
      .maybeSingle();

    if (existingAudio && existingAudio.status === 'ready' && !force) {
      // Re-evaluate recency
      if (new Date(existingAudio.updated_at).getTime() > new Date(content.updated_at).getTime()) {
        return new Response(JSON.stringify({ 
          success: true, 
          path: existingAudio.storage_path, 
          bucket: existingAudio.storage_bucket, 
          type: assetType, 
          status: 'skipped' 
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 4. Mark status = 'processing'
    await supabaseAdmin.from('verse_audio').upsert({
      book_id: bookId,
      verse_id: verseId,
      section: section,
      language: language,
      voice_id: voiceId,
      asset_type: assetType,
      storage_path: storagePath,
      storage_bucket: storageBucket,
      is_canonical: true,
      is_primary_playback: true,
      status: 'processing'
    }, { onConflict: 'book_id,verse_id,language,section,voice_id,asset_type' });

    // 5. Assemble sections by book
    let sections: string[] = [];
    if (isGita) {
      // Gita requires richer compiled_full_episode format with a spoken intro.
      const intro = language === 'hi' 
        ? `आज के पाठ में आपका स्वागत है। हम अध्याय ${chapterNo} श्लोक ${verseNo} में हैं।` 
        : `Welcome to today's lesson. We are in Chapter ${chapterNo} Verse ${verseNo}`;
      sections = [intro, sanskrit, content.translation, content.commentary, content.daily_life_application, ...examples].filter(Boolean);
    } else if (isRamayanOrMahabharat) {
      // Ramayan/Mahabharat use only invocation, story, etc., with NO lesson intro.
      sections = [sanskrit, content.translation, content.commentary, content.daily_life_application, ...examples].filter(Boolean);
    } else {
      // Fallback default
      sections = [sanskrit, content.translation, content.commentary, content.daily_life_application, ...examples].filter(Boolean);
    }

    // 6. Generate SSML, Synthesize, and Upload
    const fullSsml = processToSsml(sections.join('\n\n'), language);
    const combinedAudio = await generateChunkedTTS(fullSsml, voiceId, language, ttsApiKey);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, combinedAudio, { contentType: 'audio/mpeg', upsert: true });
    
    if (uploadError) throw uploadError;

    // 7. Update verse_audio to 'ready'
    // Demote old canonicals / primary playback flags before setting the new one to true
    await supabaseAdmin
      .from('verse_audio')
      .update({ is_canonical: false, is_primary_playback: false })
      .match({ 
        book_id: bookId, 
        verse_id: verseId, 
        language,
        asset_type: assetType
      });

    const { error: vaError } = await supabaseAdmin.from('verse_audio').upsert({
      book_id: bookId,
      verse_id: verseId,
      section: section,
      language: language,
      voice_id: voiceId,
      storage_path: storagePath,
      storage_bucket: storageBucket,
      asset_type: assetType,
      is_canonical: true,
      is_primary_playback: true,
      status: 'ready'
    }, { onConflict: 'book_id,verse_id,language,section,voice_id,asset_type' });

    if (vaError) throw vaError;

    // 8. Optionally mirror into audio_cache for legacy compatibility
    await supabaseAdmin.from('audio_cache').upsert({
      content_id: verseId, 
      content_type: 'verse', 
      section: section, 
      language, 
      voice_id: voiceId, 
      engine: 'google-tts', 
      storage_path: storagePath, 
      updated_at: new Date().toISOString()
    }, { onConflict: 'content_type,content_id,section,language,voice_id,engine' });

    return new Response(JSON.stringify({ 
      success: true, 
      path: storagePath, 
      bucket: storageBucket,
      type: assetType 
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("TTS Error:", error.message);
    
    // 9. Fail gracefully into verse_audio if metadata was available
    if (bookId && finalVerseId && language && voiceId && assetType) {
        await supabaseAdmin.from('verse_audio').upsert({
            book_id: bookId,
            verse_id: finalVerseId,
            section: section,
            language: language,
            voice_id: voiceId,
            asset_type: assetType,
            status: 'failed'
        }, { onConflict: 'book_id,verse_id,language,section,voice_id,asset_type' });
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
