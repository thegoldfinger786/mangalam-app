import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const testKey = async (key: string, name: string) => {
    console.log(`Testing ${name} (length ${key.length})...`);
    try {
        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`;
        const response = await axios.post(url, {
            input: { text: "Test" },
            voice: { languageCode: "en-US" },
            audioConfig: { audioEncoding: "MP3" }
        });
        console.log(`✅ ${name} works!`);
    } catch (err: any) {
        console.error(`❌ ${name} failed:`, err.response?.data?.error?.message || err.message);
    }
};

(async () => {
    const ttsKey = process.env.TTS_API_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || "";

    await testKey(ttsKey, "TTS_API_KEY");
    await testKey(ttsKey.trim(), "TTS_API_KEY (trimmed)");
    await testKey(geminiKey, "GEMINI_API_KEY");
})();
