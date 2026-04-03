import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const run = async () => {
    console.log('🧪 Verifying Refined Canonical Audio Layers (Phase 2)...\n');

    // 1. Check normalization
    const { data: sections } = await supabase
        .from('verse_audio')
        .select('section')
        .limit(10);
    
    const allNormalized = sections?.every(s => s.section === 'full_narrative');
    console.log(`${allNormalized ? '✅' : '❌'} Section normalization: ${allNormalized ? 'All are full_narrative' : 'Mixed sections found'}`);

    // 2. Check classification
    const { data: types } = await supabase
        .from('verse_audio')
        .select('asset_type, storage_path')
        .limit(20);
    
    const compiled = types?.filter(t => t.asset_type === 'compiled_full_episode');
    const spoken = types?.filter(t => t.asset_type === 'spoken_episode');
    
    console.log(`✅ Classification check: found ${compiled?.length} compiled and ${spoken?.length} spoken samples in first 20.`);

    // 3. Check Canonical status distribution
    const { data: canonCounts, error: canonErr } = await supabase
        .from('verse_audio')
        .select('asset_type, is_canonical')
        .limit(10000); // Get enough to see distribution

    if (canonErr) {
        console.error('❌ Error checking canonical status:', canonErr.message);
    } else {
        const stats = canonCounts.reduce((acc: any, curr: any) => {
            const key = `${curr.asset_type}_canonical_${curr.is_canonical}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        console.log('✅ Canonical Stats:', stats);
    }

    // 4. Sample Gita Canonical Fetch
    const gitaBookId = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9';
    const { data: sampleGita, error: gitaErr } = await supabase
        .from('verse_audio')
        .select('*')
        .match({ book_id: gitaBookId, is_canonical: true, asset_type: 'compiled_full_episode' })
        .limit(1)
        .single();

    if (gitaErr) {
        console.error('❌ Error fetching canonical Gita audio:', gitaErr.message);
    } else if (sampleGita) {
        console.log('✅ Canonical Gita Audio Found:');
        console.log(`   - Path:     ${sampleGita.storage_path}`);
        console.log(`   - Bucket:   ${sampleGita.storage_bucket}`);
        console.log(`   - Type:     ${sampleGita.asset_type}`);
        console.log(`   - Status:   ${sampleGita.status}`);
    }

    console.log('\n✨ Verification complete.');
};

run().catch(console.error);
