#!/usr/bin/env tsx
/**
 * Executes verse_content SQL batches using Supabase REST API (rpc/sql endpoint)
 * The /sql endpoint requires service_role key and executes raw SQL.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Also try ~/.env
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    dotenv.config({ path: path.join(process.env.HOME || '', '.env') });
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Try to list available env vars
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('supabase')));
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

async function executeSql(sql: string, batchNum: number): Promise<void> {
    // Use Supabase's DB REST endpoint for raw SQL execution
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;

    // Try the pg REST endpoint format
    const pgUrl = `${SUPABASE_URL}/pg`;

    console.log(`\nExecuting batch ${batchNum} (${sql.length.toLocaleString()} bytes)...`);

    // Use the Supabase SQL execution via the management API format
    // The actual endpoint is /rest/v1/rpc for stored procedures
    // For raw SQL, we use the supabase-js client approach
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'GET',
        headers: { 'apikey': SERVICE_ROLE_KEY!, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
    });

    console.log('API status:', response.status);
    // extract project ref from URL
    // URL format: https://<project-ref>.supabase.co
    const projectRef = SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) throw new Error('Cannot extract project ref from URL: ' + SUPABASE_URL);

    // Use the Supabase management API to execute SQL
    const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    const mgmtResp = await fetch(mgmtUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
    });

    if (!mgmtResp.ok) {
        const txt = await mgmtResp.text();
        throw new Error(`Batch ${batchNum} failed: HTTP ${mgmtResp.status} - ${txt.substring(0, 200)}`);
    }

    console.log(`✅ Batch ${batchNum} succeeded!`);
}

async function main() {
    const batches = [1, 2, 3, 4];

    for (const num of batches) {
        const sqlPath = `/tmp/vc_batch_${num}.sql`;
        if (!fs.existsSync(sqlPath)) {
            console.warn(`Skipping ${sqlPath} - file not found`);
            continue;
        }
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await executeSql(sql, num);
    }

    console.log('\n🎉 All batches completed!');
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
