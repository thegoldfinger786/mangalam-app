const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generatePreview() {
    if (!GEMINI_API_KEY) {
        console.error("Error: GEMINI_API_KEY environment variable is not set.");
        return;
    }

    const chapter = 1;
    const verse = 1;
    
    const csvPath = "/Users/sandeep/DailyShlokyaAG/scripts/data/mahabharat/chapter_1_source.csv";
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const lines = csvText.split('\n');
    const header = lines[1].trim().split(';');
    const dataRows = lines.slice(2);
    
    let targetRow = null;
    for (const line of dataRows) {
        if (!line.trim()) continue;
        const parts = line.split(';');
        if (parts[1] === String(chapter) && parts[2] === String(verse)) {
            targetRow = {};
            header.forEach((key, i) => { targetRow[key] = parts[i]; });
            break;
        }
    }

    if (!targetRow) {
        console.error("Error: Could not find Verse 1.1 in source CSV.");
        return;
    }

    const promptTemplate = fs.readFileSync("/Users/sandeep/DailyShlokyaAG/scripts/mahabharat_prompt.md", 'utf8');
    const baseSource = `EN Story: ${targetRow['translation']}\nEN Commentary: ${targetRow['commentary']}\nEN Daily Life: ${targetRow['daily_life_application']}`;
    
    const prompt = promptTemplate.replace("{{chapter}}", String(chapter))
                           .replace("{{verse}}", String(verse))
                           .replace("{{base_source}}", baseSource);

    console.log(`--- Generating English Preview for Verse ${chapter}.${verse} ---`);
    
    console.log("Starting fetch to Gemini...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generation_config: { response_mime_type: "application/json" },
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        console.log("Response received. Status:", resp.status);

        if (!resp.ok) {
            console.error(`Gemini Error: ${await resp.text()}`);
            return;
        }

        const data = await resp.json();
        console.log("JSON parsed successfully.");
    if (!data.candidates || !data.candidates[0].content) {
        console.error("Invalid response structure:", JSON.stringify(data));
        return;
    }
    const content = JSON.parse(data.candidates[0].content.parts[0].text);
    const en = content.en;
    const hi = content.hi;
    
    const formatDailyLife = (val) => typeof val === 'object' ? JSON.stringify(val, null, 2) : val;

    console.log(`\n--- ENGLISH CONTENT ---`);
    console.log(`TITLE: ${en.title}`);
    console.log(`STORY (Length: ${en.translation.split(/\s+/).length} words):\n`);
    console.log(en.translation.replace(/<break time="500ms"\/>/g, "..."));
    console.log(`\nCOMMENTARY:\n${en.commentary}`);
    console.log(`\nDAILY LIFE APPLICATION:\n${formatDailyLife(en.daily_life_application)}`);
    console.log(`\nPRACTICAL EXAMPLES:\n1. ${en.practical_examples?.[0] || "MISSING"}`);

    console.log(`\n--- HINDI CONTENT ---`);
    console.log(`शीर्षक (TITLE): ${hi.title}`);
    console.log(`कहानी (STORY) (Length: ${hi.translation.split(/\s+/).length} words):\n`);
    console.log(hi.translation.replace(/<break time="500ms"\/>/g, "..."));
    console.log(`\nटिप्पणी (COMMENTARY):\n${hi.commentary}`);
    console.log(`\nदैनिक जीवन (DAILY LIFE):\n${formatDailyLife(hi.daily_life_application)}`);
    console.log(`\nव्यावहारिक उदाहरण (PRACTICAL EXAMPLES):\n1. ${hi.practical_examples?.[0] || "MISSING"}`);
    } catch (err) {
        console.error("Gemini Request Failed:", err.message);
    }
}

generatePreview().catch(err => {
    console.error("Unhandle Error:", err);
    process.exit(1);
});
