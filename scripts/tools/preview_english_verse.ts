import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

async function generatePreview() {
    const chapter = 1;
    const verse = 1;
    
    const csvPath = "/Users/sandeep/DailyShlokyaAG/scripts/data/mahabharat/chapter_1_source.csv";
    const csvText = await Deno.readTextFile(csvPath);
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

    const promptTemplate = await Deno.readTextFile("/Users/sandeep/DailyShlokyaAG/scripts/mahabharat_prompt.md");
    const baseSource = `EN Story: ${targetRow['translation']}\nEN Commentary: ${targetRow['commentary']}\nEN Daily Life: ${targetRow['daily_life_application']}`;
    
    const prompt = promptTemplate.replace("{{chapter}}", String(chapter))
                           .replace("{{verse}}", String(verse))
                           .replace("{{base_source}}", baseSource);

    console.log(`--- Generating English Preview for Verse ${chapter}.${verse} ---`);
    
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
    });

    if (!resp.ok) {
        console.error(`Gemini Error: ${await resp.text()}`);
        return;
    }

    const data = await resp.json();
    const content = JSON.parse(data.candidates[0].content.parts[0].text);
    const en = content.en;
    
    console.log(`\nTITLE: ${en.title}`);
    console.log(`\nSTORY (Length: ${en.translation.split(/\s+/).length} words):\n`);
    console.log(en.translation.replace(/<break time="500ms"\/>/g, "..."));
    console.log(`\nCOMMENTARY:\n${en.commentary}`);
    console.log(`\nDAILY LIFE APPLICATION:\n${en.daily_life_application}`);
    console.log(`\nPRACTICAL EXAMPLES:\n1. ${en.practical_examples[0]}\n2. ${en.practical_examples[1]}`);
}

generatePreview();
