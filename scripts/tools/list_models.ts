import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const run = async () => {
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        console.log(JSON.stringify(response.data.models.map((m: any) => m.name), null, 2));
    } catch (err: any) {
        console.error('Error:', err?.response?.data || err.message);
    }
};

run();
