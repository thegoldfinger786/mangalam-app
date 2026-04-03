import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_CLOUD_API_KEY = process.env.TTS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_CLOUD_API_KEY) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VOICES = {
    hi: { male: 'hi-IN-Neural2-B', female: 'hi-IN-Neural2-A' }
};

// Only the failed IDs
const VERSE_IDS = [
    'ff9c4e66-10e0-40f4-a63c-2c8eec613238', // Male done, Female failed
    '0d3b14cb-3918-4dd9-b183-f46b374171dd' // Not found error
];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const generateTTS = async (text: string, languageCode: string, voiceName: string) => {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`;
    const chunkSize = languageCode === 'hi-IN' ? 1200 : 4000;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
        const data = {
            input: { text: chunk },
            voice: { languageCode, name: voiceName },
            audioConfig: { audioEncoding: 'MP3' }
        };
        const response = await axios.post(url, data);
        audioBuffers.push(Buffer.from(response.data.audioContent, 'base64'));
    }
    return Buffer.concat(audioBuffers);
};

const uploadAudio = async (buffer: Buffer, storagePath: string) => {
    const { data, error } = await supabase.storage
        .from('audio-content')
        .upload(storagePath, buffer, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
    return data.path;
};

const run = async () => {
    console.log('🚀 Retrying failed audio regenerations...\n');

    for (const verseId of VERSE_IDS) {
        console.log(`\n--- Processing Verse ID: ${verseId} ---`);

        // Get verse info and verse_content
        const { data: verse, error: vErr } = await supabase
            .from('verses')
            .select('verse_no')
            .eq('verse_id', verseId)
            .single();

        if (vErr) {
            console.error(`   ❌ Error fetching verse ${verseId}:`, vErr.message);
            continue;
        }

        const { data: content, error: cErr } = await supabase
            .from('verse_content')
            .select('*')
            .eq('verse_id', verseId)
            .eq('language', 'hi')
            .single();

        if (cErr) {
            console.error(`   ❌ Error fetching content for ${verseId}:`, cErr.message);
            continue;
        }

        if (!verse || !content) {
            console.error(`   ❌ Data null for ${verseId}`);
            continue;
        }

        const epNo = verse.verse_no;
        const lang = 'hi';
        const suffix = 'जय श्री राम !';

        const fullNarrative = [
            content.title,
            content.translation,
            content.commentary,
            content.daily_life_application,
            suffix
        ].filter(Boolean).join('\n\n');

        const genders = (verseId === 'ff9c4e66-10e0-40f4-a63c-2c8eec613238')
            ? ['female'] as const
            : ['male', 'female'] as const;

        for (const gender of genders) {
            const voiceId = VOICES.hi[gender];
            const languageCode = 'hi-IN';

            console.log(`   🔊 Generating ${gender} audio for Ep ${epNo}...`);
            try {
                const buffer = await generateTTS(fullNarrative, languageCode, voiceId);
                const storagePath = `verses/bk-${epNo}/${lang}_${gender}.mp3`;
                const uploadedPath = await uploadAudio(buffer, storagePath);

                const { error: upsertErr } = await supabase.from('audio_cache').upsert({
                    content_type: 'verse',
                    content_id: verseId,
                    section: 'full_narrative',
                    language: lang,
                    voice_id: voiceId,
                    engine: 'google-tts',
                    storage_path: uploadedPath
                }, { onConflict: 'content_type,content_id,section,language,voice_id,engine' });

                if (upsertErr) throw upsertErr;

                console.log(`   ✅ Audio ${gender} generated & saved at ${uploadedPath}`);
                await delay(2000); // More delay
            } catch (err: any) {
                console.error(`   ❌ Audio ${gender} failed:`, err.message);
            }
        }
    }

    console.log('\n✅ Retry process completed.');
};

run().catch(console.error);
