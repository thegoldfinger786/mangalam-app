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

const VERSE_IDS = [
    'd99d2c05-e75a-4ce3-85ec-0ddb31a874aa',
    '8a053c51-1fe4-428d-b405-ee1c5813f18e',
    '18d5a25d-d4f6-45de-871d-ebc557bfb1f6',
    '74272a52-edd1-425a-b709-629f361b3f1a',
    'c208f760-2b39-47df-acf1-28c8403782b5',
    '6e88b9a0-1140-468b-b2f6-b543aead7409',
    'cd51d9d2-b7c0-4dcb-8700-5b2c9e667b62',
    'a8e7cd02-a17e-4f24-a285-052e810059af',
    '75fa284a-14b2-42c8-9f3e-0e6300eb1b7c',
    '69213e04-36b0-4d22-a8cb-55c75be12a3d',
    '2ac59caf-86ca-452d-9099-cddc9eedb65b',
    'b61322dc-13ef-4a96-b04f-67a5dbb94cc0',
    '31af32d3-6322-404d-85df-12c0463c08bd',
    '7d8bfd5e-215c-43cf-a45e-b74c55fdeb04',
    'ca4d53d1-7e97-4cc6-bfd1-694cfc3cad1c',
    '3fd7f4a9-89f5-450e-a0bd-c1d863b773a2',
    '0cdce86d-041f-46e7-8e90-1743d4961a97',
    '0ba5dab2-7da0-4b2d-8231-8fb601ae1ac4',
    '63ad6a9e-694a-4c6a-9c0a-18e6e609f741',
    '8b8b96a6-ad06-4542-96b2-03f9fdf9e5b1',
    '27d17777-22ea-44a5-b0f8-6124412fc250',
    '4511da9b-4fc1-41fc-b060-e46afe605d08',
    'a0344371-d3ba-4c71-8ccc-13f9003b78b9',
    'dbccfb47-e1ef-4182-9ae2-eba9ab40a5df'
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
    console.log('🚀 Regenerating audio for corrected Hindi Gita verses...\n');

    for (const verseId of VERSE_IDS) {
        console.log(`\n--- Processing Verse ID: ${verseId} ---`);

        // Get verse info and verse_content
        const { data: verse } = await supabase
            .from('verses')
            .select('book_id, chapter_no, verse_no, sanskrit')
            .eq('verse_id', verseId)
            .single();


        const { data: content } = await supabase
            .from('verse_content')
            .select('*')
            .eq('verse_id', verseId)
            .eq('language', 'hi')
            .single();

        if (!verse || !content) {
            console.error(`   ❌ Could not find verse/content for ${verseId}`);
            continue;
        }

        const chapter = verse.chapter_no;
        const verseNo = verse.verse_no;
        const lang = 'hi';

        const intro = `आज के पाठ में आपका स्वागत है। हम अध्याय ${chapter} श्लोक ${verseNo} में हैं।`;
        const practicalExamples = Array.isArray(content.practical_examples)
            ? content.practical_examples
            : [];

        const fullNarrative = [
            intro,
            verse.sanskrit,
            content.translation,
            content.commentary,
            content.daily_life_application,
            ...practicalExamples
        ].filter(Boolean).join('\n\n');

        for (const gender of ['male', 'female'] as const) {
            const voiceId = VOICES.hi[gender];
            const languageCode = 'hi-IN';

            console.log(`   🔊 Generating ${gender} audio...`);
            try {
                const buffer = await generateTTS(fullNarrative, languageCode, voiceId);
                const storagePath = `verses/bg-${chapter}-${verseNo}/${lang}_${gender}.mp3`;
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
                
                // ALSO populate the canonical verse_audio table
                // Demote old canonicals and primary playback for this specific combination
                await supabase
                    .from('verse_audio')
                    .update({ is_canonical: false, is_primary_playback: false })
                    .match({ 
                        book_id: verse.book_id || '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9', 
                        verse_id: verseId, 
                        language: lang, 
                        asset_type: 'compiled_full_episode' 
                    });

                const { error: vaErr } = await supabase.from('verse_audio').upsert({
                    book_id: verse.book_id || '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9',
                    verse_id: verseId,
                    section: 'full_narrative',
                    language: lang,
                    voice_id: voiceId,
                    storage_path: uploadedPath,
                    storage_bucket: 'audio-content',
                    asset_type: 'compiled_full_episode',
                    is_canonical: true,
                    is_primary_playback: true, // Gita compiled assets are always PRIMARY
                    status: 'ready'
                }, { onConflict: 'book_id,verse_id,language,section,voice_id,asset_type' });

                if (vaErr) throw vaErr;

                console.log(`   ✅ Audio ${gender} generated & saved at ${uploadedPath}`);
                await delay(1000); // Rate limit
            } catch (err: any) {
                console.error(`   ❌ Audio ${gender} failed:`, err.message);
            }
        }
    }

    console.log('\n✅ All regenerations attempted.');
};

run().catch(console.error);
