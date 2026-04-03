import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VERSE_IDS = [
  "12e2daa8-16a0-4649-b488-4466bd75b7ee",
  "3bcd09ae-984c-4432-b725-3ba731fc8522",
  "a3920a77-a046-4b4f-9217-9c4e79fa2fe5",
  "6ba0ca35-2974-45a4-a156-b2b48f8b5e2c",
  "9a0b24cb-4455-45ad-876c-a853ff4fb46a",
  "818a1951-5546-40f9-b086-e28ec72f09e2",
  "c6391c43-8088-4248-85de-e8a6b32a793b",
  "9749687b-3b96-4d27-a006-4132e0d9bf54",
  "17c394b9-f8dd-4e7b-80dc-1d17f911cc64",
  "78817f43-c432-4fa1-8586-2a2d8f8c6dfd",
  "69b47600-7d3e-4a2c-88ee-df032c394705",
  "99425549-8f71-4237-aaed-66486c715ff6",
  "1e20d952-32ec-43b1-a5b2-8992e8acce7c",
  "f912fe62-e638-4aaa-a1f4-7fc74cac0a08",
  "a24c501e-f17d-4b4a-9f9d-e792e0e419d5",
  "c4660a08-b2a0-46ef-a550-ce35d7644a38",
  "af218046-ff14-4b3d-833a-bd279d46a120",
  "5da2ce03-5238-4f15-a85b-26e9f62f8048",
  "91dc028e-3494-455d-8d4a-77e690d14cc3",
  "f72b844c-4d96-48eb-8045-b8f238225c63",
  "198eba97-f1ff-4829-8700-40dc52e659c9",
  "ee8ac36c-4ec7-41c2-ae11-00bf45cc225f",
  "50e51c0a-c126-4bab-b9ed-d8d2d30401d3",
  "f9301e20-868e-486f-b457-f563c5521cb4",
  "161043f1-b972-4e92-a5b4-3c92c1a95305",
  "f2ca8ba5-db35-4b85-804c-bf65712902e1",
  "1c4ef2dc-64f4-4998-880d-06b6d93467e0",
  "ec8bc173-3e5c-4e03-8cf7-e3adf82f41f7",
  "774642fd-ebf5-4db8-84db-b2f73c0cc0a4",
  "476bace9-9f8c-405f-9765-61124878f77f",
  "281504fd-7448-4840-8c0c-a3080c5e1ac3",
  "9c3f5cc6-7052-4e1a-b4c7-699b4bb23993",
  "5e33c946-cd38-4d12-a9e4-e8965ef62944",
  "f618d63e-44ae-4289-807e-a759f1adda7e",
  "48196272-b514-4126-8c21-d32b1aafe1c5",
  "9306e712-3093-4ea2-a5ce-65121592940a",
  "4541a15c-4147-4b76-99d1-4500b3b53c18",
  "b96d9ccd-7d0f-46e1-9727-385ff6b1fd61",
  "cba22339-f29b-450b-bd10-b580a3e2a0e4",
  "4107bf90-1c05-49ca-a3da-4c8d990159a4",
  "da064b4a-798a-4ae6-a6e6-9a072f943c6c",
  "ff9c4e66-10e0-40f4-a63c-2c8eec613238",
  "66adffe1-f949-48da-8b4c-5249eea9e554",
  "e65ad138-a659-48f4-9892-105281efe333",
  "5611db20-8d31-4aba-af0e-210d81d81dc6",
  "0d3b14cb-3918-4dd9-b183-f46b374171dd",
  "ea2e1332-3d14-4875-aaaf-1428fe8b3f0c"
];

const SELECTED_VERSE_IDS = VERSE_IDS; // Use the full list

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const run = async () => {
    console.log(`🚀 Regenerating audio for ${VERSE_IDS.length} verses via Edge Function...\n`);

    for (const verseId of VERSE_IDS) {
        console.log(`\n--- Processing Verse ID: ${verseId} ---`);

        for (const lang of ['en', 'hi'] as const) {
            for (const gender of ['male', 'female'] as const) {
                console.log(`   🔊 Triggering Edge Function for ${lang}/${gender}...`);
                try {
                    const { data, error } = await supabase.functions.invoke('generate-tts', {
                        body: {
                            verse_id: verseId,
                            language: lang,
                            gender: gender,
                            force: true
                        }
                    });

                    if (error) throw error;
                    const status = data.status === 'skipped' ? '✅ Up to date' : '✅ Regenerated';
                    console.log(`   ${status}: ${data.path}`);
                } catch (err: any) {
                    console.error(`   ❌ Failed:`, err);
                }
            }
        }
        await delay(100); // Small pause between verses
    }

    console.log('\n✅ All regenerations attempted.');
};

run().catch(console.error);
