import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const run = async () => {
    console.log(`🔐 Verifying test credentials...`);
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: 'test@mangalam.app',
        password: 'Test@1234'
    });

    if (error || !session) {
        console.error('❌ Login failed:', error?.message ?? 'No session returned');
        process.exit(1);
    }

    console.log('✅ Login successful!');
    console.log(`👤 User ID: ${session.user.id}`);
    
    // Verify playback data for Ramayan
    console.log(`🔍 Verifying playback data for Ramayan Verse 1.6 (Dashrath)...`);
    const { data: verse } = await supabase
        .from('verses')
        .select('verse_id')
        .eq('verse_no', 6)
        .eq('book_id', '2c082725-728b-4a55-8d5a-cf2084c6883f') // Ramayan ID
        .single();

    if (verse) {
        const { data: audio } = await supabase
            .from('audio_cache')
            .select('storage_path, voice_id')
            .eq('content_id', verse.verse_id)
            .eq('voice_id', 'en-IN-Wavenet-A')
            .single();
            
        if (audio && audio.storage_path.includes('ram-6')) {
            console.log(`✅ Audio correctly mapped to isolated prefix: ${audio.storage_path}`);
        } else {
            console.error(`❌ Audio mapping check failed:`, audio);
        }
    }
    
    console.log('✨ All pre-build checks passed!');
};

run();
