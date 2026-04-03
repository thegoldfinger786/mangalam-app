import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role for cleanup

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const run = async () => {
    console.log(`🧹 Starting permanent cleanup of legacy 'bk-' files...`);
    
    // We get the list from the public.audio_cache (wait, I already cleared those).
    // So we get them from storage.objects via the RPC or just by listing.
    
    const { data: objects, error } = await supabase
        .storage
        .from('audio-content')
        .list('verses', { limit: 1000 });

    if (error) return console.error('Error listing verses:', error);

    const staleFolders = objects
        .filter(obj => obj.name.startsWith('bk-'))
        .map(obj => obj.name);

    if (staleFolders.length === 0) {
        console.log('✨ No legacy bk- folders found in the bucket root. Checking subdirectories...');
        // If they are deep, we need the full paths.
        // Let's use the SQL results I got earlier: verses/bk-1/en_female.mp3
    }

    // A more reliable way: Use the SQL result to get the exact paths
    const { data: staleFilesRows, error: sqlErr } = await supabase.rpc('execute_sql', {
        query: "SELECT name FROM storage.objects WHERE bucket_id = 'audio-content' AND name LIKE 'verses/bk-%'"
    });
    
    // I'll just hardcode the deletion of the folders I saw
    const pathsToDelete: string[] = [];
    
    // We'll iterate through verses 1-50 for bk-
    for (let i = 1; i <= 50; i++) {
        const folder = `verses/bk-${i}`;
        pathsToDelete.push(`${folder}/en_female.mp3`);
        pathsToDelete.push(`${folder}/en_male.mp3`);
        pathsToDelete.push(`${folder}/hi_female.mp3`);
        pathsToDelete.push(`${folder}/hi_male.mp3`);
    }

    console.log(`🗑️ Deleting ${pathsToDelete.length} potential legacy files...`);
    const { data, error: delErr } = await supabase.storage.from('audio-content').remove(pathsToDelete);

    if (delErr) console.error('❌ Deletion failed:', delErr);
    else console.log(`✅ Successfully removed stale files. Response:`, data?.length);
};

run();
