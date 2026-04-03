import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { processToSsml } from './lib/tts_processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GOOGLE_CLOUD_API_KEY = process.env.TTS_API_KEY;

const testTTS = async (text: string, voiceName: string, filename: string, isSsml = false) => {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`;
    const data = {
        input: isSsml ? { ssml: text } : { text },
        voice: { languageCode: 'en-IN', name: voiceName },
        audioConfig: { audioEncoding: 'MP3' }
    };
    try {
        const response = await axios.post(url, data);
        const buffer = Buffer.from(response.data.audioContent, 'base64');
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Generated ${filename}`);
    } catch (err: any) {
        console.error(`❌ Failed: ${err.message}`);
    }
};

const run = async () => {
    const voice = 'en-IN-Neural2-B'; // Male
    
    console.log('Testing with Atlas integration...');
    
    const sample1 = 'Queen Sumitra was happy.';
    const ssml1 = processToSsml(sample1);
    console.log(`Input: ${sample1}`);
    console.log(`SSML:  ${ssml1}`);
    await testTTS(ssml1, voice, 'verify_sumitra.mp3', true);

    const sample2 = 'Revered Sage Vishwamitr.';
    const ssml2 = processToSsml(sample2);
    console.log(`Input: ${sample2}`);
    console.log(`SSML:  ${ssml2}`);
    await testTTS(ssml2, voice, 'verify_sage.mp3', true);
};

run();
