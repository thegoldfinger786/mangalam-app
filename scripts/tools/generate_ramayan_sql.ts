import * as fs from 'fs';

const updates = JSON.parse(fs.readFileSync('ramayan_updates.json', 'utf8'));

let sql = '';

for (const update of updates) {
    const greeting = update.language === 'hi' ? '["जय श्री राम"]' : '["Jai Shri Ram"]';
    const escapedDaily = update.daily_life_application.replace(/'/g, "''");
    
    sql += `UPDATE verse_content SET daily_life_application = '${escapedDaily}', practical_examples = '${greeting}' WHERE id = '${update.id}';\n`;
}

fs.writeFileSync('ramayan_updates.sql', sql);
console.log('ramayan_updates.sql created');
