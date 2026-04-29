#!/usr/bin/env node
/**
 * Updates .env.local with the v2 Notion DB IDs.
 * Preserves all existing non-NOTION env vars (NOTION_TOKEN, CLAUDE_API_KEY, etc.).
 *
 * Usage:  node scripts/set-local-env-v2.js
 */

const fs = require('fs');
const path = require('path');

const V2 = {
  NOTION_PROJECTS_DB:      'ee55983748e64b5382823ab5d1a0a192',
  NOTION_PEOPLE_DB:        '57cfd1f84a654c7dbe0448f07cd12725',
  NOTION_CLIENTS_DB:       '2db7bd36cbd64d6d859b9bdf9dde62d8',
  NOTION_DELIVERABLES_DB:  'a637527fa2b04ccd85c29c2bd9714a51',
  NOTION_SCHEDULE_DB:      '3502d6b7290f81a1a435cbb39587a1da',
  NOTION_INPUTS_DB:        '3502d6b7290f819f9941c83920e850b6',
  NOTION_ISSUES_DB:        '3502d6b7290f81918496f8a7c66b336c',
  NOTION_COMMS_DB:         '3502d6b7290f8115ab00daba52d73f7d',
  NOTION_DOCUMENTS_DB:     '3502d6b7290f8110b12ee7f16a849065',
  NOTION_MODEL_UPDATES_DB: '3502d6b7290f8192867ae2fdb7a02c9c',
  NOTION_COMMERCIAL_DB:    '3502d6b7290f81b9a0e6cd3b275887ba',
  NOTION_MANMONTHS_DB:     '3502d6b7290f81fb9a84f307e68f43ee',
  NOTION_VARIATIONS_DB:    '3502d6b7290f819ca667ee7f7d3bc0f9',
  NOTION_KPI_DB:           '3502d6b7290f819b8da8d7d014812a45',
  NOTION_TIMESHEETS_DB:    '3502d6b7290f8189aa10d0aebaa1ba15',
};

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found. Aborting.');
  process.exit(1);
}

// Parse existing file, preserving comments and non-NOTION lines
const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const updated = [];
const handled = new Set();

for (const line of lines) {
  const m = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=/);
  if (m && V2[m[1]] !== undefined) {
    updated.push(`${m[1]}="${V2[m[1]]}"`);
    handled.add(m[1]);
  } else {
    updated.push(line);
  }
}

// Add any NOTION_*_DB vars that weren't in the original file
for (const [k, v] of Object.entries(V2)) {
  if (!handled.has(k)) {
    updated.push(`${k}="${v}"`);
    handled.add(k);
  }
}

// Backup before writing
fs.writeFileSync(envPath + '.bak', fs.readFileSync(envPath, 'utf8'));
fs.writeFileSync(envPath, updated.join('\n'));

console.log('✔ Updated .env.local with v2 Notion DB IDs');
console.log(`✔ Backup saved to .env.local.bak`);
console.log('\nUpdated keys:');
for (const k of handled) console.log(`  ${k} = ${V2[k]}`);
console.log('\nNow re-run:  node scripts/import-from-folders.js --root "..\\MASTER REGISTERS" --project "H2R" --limit 50');
