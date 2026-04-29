#!/usr/bin/env node
/**
 * Folder → Notion importer
 *
 * Walks the MASTER REGISTERS folder structure and pushes records into the
 * matching Notion databases. Uses the folder layout as a schema:
 *
 *   <MASTER_REGISTERS_ROOT>/
 *     <Project_Name>/
 *       TIER_2_PRODUCTION_TRACKING/
 *         DB-1_Deliverables_Register/
 *           <Stage>/                       e.g. LOD_200_Input, Submitted, Approved
 *             <Date>_(<description>)/      e.g. 03-12-2025_(marketing plans)
 *               <file>.pdf                 e.g. 2BDR - Wall Finishes.pdf
 *
 * Each leaf file becomes one Notion row. Folder names encode the status,
 * submission stage, and submission date — so we don't need the file contents.
 *
 * Usage:
 *   node scripts/import-from-folders.js --root "<path>" [--project "H2R"] [--db 1] [--dry-run] [--limit 50]
 *
 * Flags:
 *   --root     Path to MASTER REGISTERS folder (required)
 *   --project  Match project folders that include this substring (optional; default: all)
 *   --db       Only import this DB number (1,3,4,5,6,7,8,9,10,11,12) — default: all applicable
 *
 *   Tier-2 DBs (production tracking): 1=Deliverables, 3=Inputs, 4=Issues, 5=Comms, 6=Docs, 7=Model Updates
 *   Tier-3 DBs (commercial/perf):     8=Commercial/Invoices, 9=Manmonths, 10=Variations, 11=KPI, 12=Timesheets
 *   --dry-run  Print what would be imported but don't POST to Notion
 *   --limit    Max records per DB (safety guard, default: 500)
 *
 * Notion DB IDs are read from .env.local.
 */

const fs   = require('fs');
const path = require('path');
// Use native fetch (Node 18+) so we don't need @notionhq/client or node-fetch.

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const ROOT    = getArg('--root')    || process.env.MASTER_REGISTERS_ROOT;
const PROJ_F  = getArg('--project') || '';
const DB_F    = getArg('--db')      || '';
const DRY     = args.includes('--dry-run');
const LIMIT   = parseInt(getArg('--limit', '500'), 10);

if (!ROOT) {
  console.error('Usage: node scripts/import-from-folders.js --root "<MASTER REGISTERS path>"');
  process.exit(1);
}

// ── Load .env.local manually ─────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error('NOTION_TOKEN is not set');
  process.exit(1);
}

// Minimal Notion REST client (native fetch)
const NOTION_HEADERS = {
  'Authorization':   `Bearer ${NOTION_TOKEN}`,
  'Content-Type':    'application/json',
  'Notion-Version':  '2022-06-28',
};

async function notionCreatePage(databaseId, properties) {
  const resp = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST', headers: NOTION_HEADERS,
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

// Query a database (paginated) and return page IDs keyed by the title field.
async function notionBuildTitleIndex(databaseId, titlePropName) {
  const index = new Map();
  let cursor;
  do {
    const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST', headers: NOTION_HEADERS,
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Query ${databaseId}: ${resp.status}: ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    for (const page of data.results) {
      const p = page.properties;
      const title = (p[titlePropName]?.title || [])[0]?.plain_text;
      if (title) index.set(title.toLowerCase().trim(), page.id);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return index;
}

// Build a set of existing record titles in a DB so we can skip duplicates.
// Keyed by "<project_page_id>||<lowercased title>". If no project relation,
// keyed by just "||<title>".
// This is cached per DB ID so repeated calls are free.
const _existingKeyCache = new Map();

async function buildExistingKeys(databaseId, titlePropName, projectRelField = 'Project') {
  if (_existingKeyCache.has(databaseId)) return _existingKeyCache.get(databaseId);
  const keys = new Set();
  let cursor;
  do {
    const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST', headers: NOTION_HEADERS,
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
    });
    if (!resp.ok) break;
    const data = await resp.json();
    for (const page of data.results) {
      const p = page.properties;
      const title = (p[titlePropName]?.title || [])[0]?.plain_text;
      if (!title) continue;
      const projIds = (p[projectRelField]?.relation || []).map(r => r.id);
      if (projIds.length) {
        for (const pid of projIds) keys.add(`${pid}||${title.toLowerCase().trim()}`);
      } else {
        keys.add(`||${title.toLowerCase().trim()}`);
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  _existingKeyCache.set(databaseId, keys);
  return keys;
}

function dupKey(projectPageId, title) {
  return `${projectPageId || ''}||${(title || '').toLowerCase().trim()}`;
}

// Fetch DB schema so we know which properties exist and what type they are.
async function notionGetDbSchema(databaseId) {
  const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: NOTION_HEADERS,
  });
  if (!resp.ok) throw new Error(`Schema fetch ${databaseId}: ${resp.status}`);
  const data = await resp.json();
  return data.properties || {};
}

// DB routing
const DB_IDS = {
  1:  process.env.NOTION_DELIVERABLES_DB,
  2:  process.env.NOTION_SCHEDULE_DB,
  3:  process.env.NOTION_INPUTS_DB,
  4:  process.env.NOTION_ISSUES_DB,
  5:  process.env.NOTION_COMMS_DB,
  6:  process.env.NOTION_DOCUMENTS_DB,
  7:  process.env.NOTION_MODEL_UPDATES_DB,
  8:  process.env.NOTION_COMMERCIAL_DB,
  9:  process.env.NOTION_MANMONTHS_DB,
  10: process.env.NOTION_VARIATIONS_DB,
  11: process.env.NOTION_KPI_DB,
  12: process.env.NOTION_TIMESHEETS_DB,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// Map folder names (on disk) to the app-side project name. The resolver in
// _notionDbs.js then translates that to the Notion DB-A page via its alias
// map + fuzzy matching.
const FOLDER_TO_PROJECT = {
  'abaad wood_arch':                   'Abaad Wood — Joinery Shop Drawings',
  'admin bldg_mep':                    'Admin Building MEP',
  'al-badia phase 6':                  'Al-Badia Phase 6',
  'alemco (wynn)  _mep':               'ALEMCO Wynn Al Marjan Island',
  'alemco (wynn) _mep':                'ALEMCO Wynn Al Marjan Island',
  'dar':                               'DAR Project',
  'data center _mep':                  'Data Center MEP',
  'data center_mep':                   'Data Center MEP',
  'golf hill':                         'Golf Hillside',
  'h2r_arch':                          'H2R_ALTA Maison Margiela Residences',
  'metro project_mep':                 'Metro Project MEP',
  'ot sky palace_arch':                'OT Sky Palace Architecture',
  'orla towers_arch':                  'Orla Towers Architecture',
  'top golf':                          'Top Golf',
  'wph ksa (lod 200 to 350)_arch':     'WPH KSA',
};

function projectNameFromFolder(folderName) {
  // Explicit map first (handles all 13 project folders exactly)
  const key = folderName.toLowerCase().replace(/\s+/g, ' ').trim();
  if (FOLDER_TO_PROJECT[key]) return FOLDER_TO_PROJECT[key];
  // Fallback: strip _Arch/_MEP suffix and parenthetical suffixes
  let n = folderName
    .replace(/_Arch$|_MEP$/i, '')
    .replace(/\s*\([^)]+\)\s*/g, '')
    .trim();
  return n;
}

function parseDateFolder(folderName) {
  // "03-12-2025_(marketing plans)" → { date: '2025-12-03', description: 'marketing plans' }
  const m = folderName.match(/^(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?:[_\s]*\((.+?)\))?/);
  if (!m) return { date: null, description: folderName };
  const [, d, mo, y, desc] = m;
  return {
    date: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`,
    description: desc || folderName,
  };
}

// Walk a subfolder N levels deep, returning [{ stage, date, description, file, fullPath }]
function walkLeaves(startDir) {
  const out = [];
  if (!fs.existsSync(startDir)) return out;
  const stages = fs.readdirSync(startDir).filter(f => {
    const p = path.join(startDir, f);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });
  for (const stage of stages) {
    const stagePath = path.join(startDir, stage);
    const entries = fs.readdirSync(stagePath);
    for (const entry of entries) {
      const entryPath = path.join(stagePath, entry);
      let stat;
      try { stat = fs.statSync(entryPath); } catch { continue; }
      if (stat.isFile()) {
        // File directly in stage folder
        out.push({ stage, date: null, description: '', file: entry, fullPath: entryPath });
      } else if (stat.isDirectory()) {
        const { date, description } = parseDateFolder(entry);
        const subEntries = fs.readdirSync(entryPath);
        for (const sub of subEntries) {
          const subPath = path.join(entryPath, sub);
          try {
            if (fs.statSync(subPath).isFile()) {
              out.push({ stage, date, description, file: sub, fullPath: subPath });
            }
          } catch {}
        }
      }
    }
  }
  return out;
}

// ── Importers per DB ─────────────────────────────────────────────────────────
// Track skipped duplicates per run so we can summarise at the end
const _runStats = { created: 0, skipped: 0, failed: 0 };

async function createRow(dbId, properties, pageTitle, dupCheck) {
  if (DRY) {
    if (dupCheck?.existingKeys?.has(dupCheck.key)) {
      console.log(`  [DRY skip] ${pageTitle}  (dup)`);
      _runStats.skipped++;
    } else {
      console.log(`  [DRY] ${pageTitle}`);
    }
    return;
  }
  // Idempotency: skip if this (project, title) already exists in the DB
  if (dupCheck?.existingKeys?.has(dupCheck.key)) {
    process.stdout.write('-');  // '-' means "skipped (dup)"
    _runStats.skipped++;
    return;
  }
  try {
    await notionCreatePage(dbId, properties);
    process.stdout.write('.');
    _runStats.created++;
    // Mark newly-created as existing so the same run doesn't re-create them
    if (dupCheck) dupCheck.existingKeys.add(dupCheck.key);
  } catch (e) {
    console.error(`\n  ✖ ${pageTitle}: ${e.message.slice(0, 160)}`);
    _runStats.failed++;
  }
}

// Small sleep helper (Notion rate limit ~3 req/s)
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Project page ID cache (DB-A), keyed by lowercased project name (alias-aware).
let _projectIndex = null;
async function getProjectPageId(projectName) {
  if (!process.env.NOTION_PROJECTS_DB) return null;
  if (!_projectIndex) {
    console.log('  (Building DB-A Projects index...)');
    _projectIndex = await notionBuildTitleIndex(process.env.NOTION_PROJECTS_DB, 'Name');
    console.log(`  (Indexed ${_projectIndex.size} projects)`);
  }
  const key = projectName.toLowerCase().trim();
  if (_projectIndex.has(key)) return _projectIndex.get(key);
  // Fuzzy: look for a project whose title contains the search name
  for (const [k, v] of _projectIndex) if (k.includes(key) || key.includes(k)) return v;
  return null;
}

async function importDeliverables(projectName, projectDir) {
  const dbId = DB_IDS[1];
  if (!dbId) return console.log('  ⚠ DB-1 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-1_Deliverables_Register');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-1 Deliverables] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;

  // Resolve project relation (DB-1.Project points to DB-A.Projects Master).
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  if (!DRY && !projectPageId) {
    console.log(`  ⚠ Project "${projectName}" not found in DB-A. Rows will be created without a Project link.`);
  }
  // Build duplicate-detection index once per DB
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  // Stage → LOD Stage + Approval Status mappings (matches DB-1 v2 schema options).
  // v2 LOD Stage options: LOD 100 / LOD 200 / LOD 300 / LOD 400 / LOD 500 / Submitted / Approved
  // v2 Approval Status:   Not Submitted / Submitted / Under Review / Approved / Approved with Comments / Rejected / Resubmit
  const stageMap = {
    'LOD_100':              { lodStage: 'LOD 100',   approvalStatus: 'Not Submitted' },
    'LOD_200_Input':        { lodStage: 'LOD 200',   approvalStatus: 'Not Submitted' },
    'LOD_200':              { lodStage: 'LOD 200',   approvalStatus: 'Not Submitted' },
    'LOD_300_WIP':          { lodStage: 'LOD 300',   approvalStatus: 'Not Submitted' },
    'LOD_300_QC':           { lodStage: 'LOD 300',   approvalStatus: 'Under Review'  },
    'LOD_300_Coordinated':  { lodStage: 'LOD 300',   approvalStatus: 'Under Review'  },
    'LOD_300':              { lodStage: 'LOD 300',   approvalStatus: 'Not Submitted' },
    'LOD_400':              { lodStage: 'LOD 400',   approvalStatus: 'Not Submitted' },
    'LOD_500':              { lodStage: 'LOD 500',   approvalStatus: 'Not Submitted' },
    'Submitted':            { lodStage: 'Submitted', approvalStatus: 'Submitted'     },
    'Approved':             { lodStage: 'Approved',  approvalStatus: 'Approved'      },
  };

  for (const l of leaves) {
    const map = stageMap[l.stage] || { lodStage: null, approvalStatus: null };
    const drawingTitle  = path.basename(l.file, path.extname(l.file));
    const drawingNumber = (drawingTitle.match(/^([A-Z0-9][A-Z0-9._-]{2,})/i) || [])[1] || '';
    const discipline    = projectDir.toLowerCase().includes('mep') ? 'Coordination' : 'Architectural';

    const props = {
      'Name':  { title: [{ text: { content: drawingTitle.slice(0, 500) } }] },
      'Drawing Number': drawingNumber ? { rich_text: [{ text: { content: drawingNumber.slice(0, 200) } }] } : undefined,
      'LOD Stage':      map.lodStage       ? { select: { name: map.lodStage } }       : undefined,
      'Approval Status':map.approvalStatus ? { select: { name: map.approvalStatus } } : undefined,
      'Discipline':     { select: { name: discipline } },
      'Actual Submission Date': (l.date && /submitted|approved/i.test(l.stage)) ? { date: { start: l.date } } : undefined,
      'Planned Submission Date': (l.date && !/submitted|approved/i.test(l.stage)) ? { date: { start: l.date } } : undefined,
      'Remarks':        l.description ? { rich_text: [{ text: { content: l.description.slice(0, 2000) } }] } : undefined,
      'Project':        projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, drawingTitle, { existingKeys, key: dupKey(projectPageId, drawingTitle) });
    await sleep(250);
  }
}

async function importInputs(projectName, projectDir) {
  const dbId = DB_IDS[3];
  if (!dbId) return console.log('  ⚠ DB-3 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-3_Inputs_Prerequisites');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-3 Inputs] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');
  for (const l of leaves) {
    const item = path.basename(l.file, path.extname(l.file));
    const props = {
      'Name': { title: [{ text: { content: item } }] },
      'Input Type':        { select: { name: l.stage.replace(/_/g, ' ') } },
      'Received Date':     l.date ? { date: { start: l.date } } : undefined,
      'Status':            { select: { name: 'Received' } },
      'Project':           projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, item, { existingKeys, key: dupKey(projectPageId, item) });
    await sleep(250);
  }
}

async function importIssues(projectName, projectDir) {
  const dbId = DB_IDS[4];
  if (!dbId) return console.log('  ⚠ DB-4 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-4_RFI_Issues_Clash');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-4 Issues] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');
  // Map folder stage strings → DB-4 valid Type select options
  const issueTypeMap = (stage) => {
    const s = stage.toLowerCase();
    if (s.includes('rfi'))      return 'RFI';
    if (s.includes('hard'))     return 'Hard Clash';
    if (s.includes('soft'))     return 'Soft Clash';
    if (s.includes('design'))   return 'Design Issue';
    if (s.includes('missing'))  return 'Missing Info';
    if (s.includes('scope'))    return 'Scope Change';
    return 'Query';
  };
  for (const l of leaves) {
    const ref = path.basename(l.file, path.extname(l.file));
    const props = {
      'Name':        { title: [{ text: { content: ref } }] },
      'Type':        { select: { name: issueTypeMap(l.stage) } },
      'Raised Date': l.date ? { date: { start: l.date } } : undefined,
      'Status':      { select: { name: 'Open' } },
      'Project':     projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, ref, { existingKeys, key: dupKey(projectPageId, ref) });
    await sleep(250);
  }
}

async function importComms(projectName, projectDir) {
  const dbId = DB_IDS[5];
  if (!dbId) return console.log('  ⚠ DB-5 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-5_Communications_Submissions');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-5 Comms] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');
  // Map folder stage strings → DB-5 valid Comm Type select options
  const commTypeMap = (stage) => {
    const s = stage.toLowerCase();
    if (s.includes('mom'))      return 'MOM';
    if (s.includes('letter'))   return 'Letter';
    if (s.includes('email'))    return 'Email';
    if (s.includes('phone'))    return 'Phone Call';
    if (s.includes('teams'))    return 'Teams Message';
    if (s.includes('whatsapp')) return 'WhatsApp';
    return 'Transmittal';
  };
  for (const l of leaves) {
    const ref = path.basename(l.file, path.extname(l.file));
    const props = {
      'Name':      { title: [{ text: { content: ref } }] },
      'Comm Type': { select: { name: commTypeMap(l.stage) } },
      'Date':      l.date ? { date: { start: l.date } } : undefined,
      'Project':   projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, ref, { existingKeys, key: dupKey(projectPageId, ref) });
    await sleep(250);
  }
}

async function importDocuments(projectName, projectDir) {
  const dbId = DB_IDS[6];
  if (!dbId) return console.log('  ⚠ DB-6 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-6_Document_Register');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-6 Documents] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');
  // Map folder stage strings → DB-6 valid Category select options
  const categoryMap = (stage) => {
    const s = stage.toLowerCase();
    if (s.includes('bep'))      return 'BEP';
    if (s.includes('midp'))     return 'MIDP';
    if (s.includes('execution'))return 'Execution Plan';
    if (s.includes('kickoff'))  return 'Kickoff Document';
    if (s.includes('material')) return 'Material Submittal';
    if (s.includes('asset'))    return 'Asset Data';
    if (s.includes('lpo'))      return 'LPO';
    if (s.includes('meeting'))  return 'Meeting Notes';
    if (s.includes('monthly'))  return 'Monthly Report';
    if (s.includes('org'))      return 'Org Chart';
    return 'Meeting Notes';
  };
  for (const l of leaves) {
    const docNo = path.basename(l.file, path.extname(l.file));
    const props = {
      'Name':     { title: [{ text: { content: docNo } }] },
      'Category': { select: { name: categoryMap(l.stage) } },
      'Date':     l.date ? { date: { start: l.date } } : undefined,
      'Project':  projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, docNo, { existingKeys, key: dupKey(projectPageId, docNo) });
    await sleep(250);
  }
}

async function importModelUpdates(projectName, projectDir) {
  const dbId = DB_IDS[7];
  if (!dbId) return console.log('  ⚠ DB-7 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_2_PRODUCTION_TRACKING', 'DB-7_Model_Updates_Log');
  const leaves = walkLeaves(dir).slice(0, LIMIT);
  console.log(`\n[DB-7 Model Updates] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');
  for (const l of leaves) {
    const rev = path.basename(l.file, path.extname(l.file));
    const props = {
      'Name':    { title: [{ text: { content: rev } }] },
      'Date':    l.date ? { date: { start: l.date } } : undefined,
      'Summary': l.description ? { rich_text: [{ text: { content: l.description.slice(0, 2000) } }] } : { rich_text: [{ text: { content: l.stage.replace(/_/g, ' ') } }] },
      'Project': projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, rev, { existingKeys, key: dupKey(projectPageId, rev) });
    await sleep(250);
  }
}

// ── TIER 3 importers ─────────────────────────────────────────────────────────
// Recursively walk a directory and return every file with a path-segment array
// relative to the start dir. e.g. for path startDir/Internal_Review/Sub/file.pdf,
// returns { segments: ['Internal_Review','Sub'], file: 'file.pdf', fullPath }.
function walkAllFiles(startDir) {
  const out = [];
  function recurse(curDir, segments) {
    if (!fs.existsSync(curDir)) return;
    let entries;
    try { entries = fs.readdirSync(curDir); } catch { return; }
    for (const entry of entries) {
      const full = path.join(curDir, entry);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) recurse(full, segments.concat(entry));
      else if (stat.isFile()) out.push({ segments, file: entry, fullPath: full });
    }
  }
  recurse(startDir, []);
  return out;
}

// Map a date-like substring inside a filename to ISO YYYY-MM-DD (best effort).
function parseDateFromFilename(name) {
  // "Jan 2026", "Feb 2026", "Mar 2026"... + "December 2025"
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
                   january:1, february:2, march:3, april:4, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
  const m1 = name.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[\-_]?\s*(20\d\d)/i);
  if (m1) return `${m1[2]}-${String(months[m1[1].toLowerCase()]).padStart(2,'0')}-01`;
  // Just a month name (no year) — assume year from file structure (skip)
  const m2 = name.match(/^([A-Z][a-z]+)\s+(Timesheet|Month|Claim)/i);
  if (m2 && months[m2[1].toLowerCase()]) {
    return `2026-${String(months[m2[1].toLowerCase()]).padStart(2,'0')}-01`;
  }
  // dd-mm-yyyy
  const m3 = name.match(/(\d{1,2})[-_.](\d{1,2})[-_.](20\d\d)/);
  if (m3) return `${m3[3]}-${m3[2].padStart(2,'0')}-${m3[1].padStart(2,'0')}`;
  // yyyy-mm-dd
  const m4 = name.match(/(20\d\d)[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (m4) return `${m4[1]}-${m4[2].padStart(2,'0')}-${m4[3].padStart(2,'0')}`;
  return null;
}

async function importCommercial(projectName, projectDir) {
  const dbId = DB_IDS[8];
  if (!dbId) return console.log('  ⚠ DB-8 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_3_COMMERCIAL_PERFORMANCE', 'DB-8_Commercial_Invoicing');
  const leaves = walkAllFiles(dir).slice(0, LIMIT);
  console.log(`\n[DB-8 Commercial] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  // Folder name → v2 Status select option
  const statusMap = {
    'Draft':                'Draft',
    'Internal_Review':      'Under Review',
    'Submitted_to_Client':  'Submitted',
    'Under_Client_Review':  'Under Review',
    'Certified':            'Approved',
    'Payment_Received':     'Paid',
    'Disputed':             'Rejected',
  };

  for (const l of leaves) {
    const title = path.basename(l.file, path.extname(l.file));
    const statusFolder = l.segments[0] || '';
    const status = statusMap[statusFolder] || 'Draft';
    // Detect Type
    const lower = title.toLowerCase();
    let type = 'PA Claim';
    if (lower.includes('inv') && /\d{6}/.test(lower))      type = 'Invoice';
    else if (lower.includes('credit'))                     type = 'Credit Note';
    else if (lower.includes('variation'))                  type = 'Variation Invoice';
    // Invoice number from filename like "JES_Inv_H2R_ALTA_250139" or "PC05 - JES- Orla 50954"
    const invNo = (title.match(/(?:Inv[_\s-]+|PC\d+\s*-\s*JES[-_\s]+\w+\s+)(\d{4,})/i) || [])[1] || '';
    const date = parseDateFromFilename(title);

    const props = {
      'Name':       { title: [{ text: { content: title.slice(0, 500) } }] },
      'Invoice No': invNo ? { rich_text: [{ text: { content: invNo } }] } : undefined,
      'Type':       { select: { name: type } },
      'Status':     { select: { name: status } },
      'Issue Date': date ? { date: { start: date } } : undefined,
      'Currency':   { select: { name: 'AED' } },
      'Project':    projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, title, { existingKeys, key: dupKey(projectPageId, title) });
    await sleep(250);
  }
}

async function importManmonths(projectName, projectDir) {
  const dbId = DB_IDS[9];
  if (!dbId) return console.log('  ⚠ DB-9 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_3_COMMERCIAL_PERFORMANCE', 'DB-9_Manmonth_Consumption');
  const leaves = walkAllFiles(dir).slice(0, LIMIT);
  console.log(`\n[DB-9 Manmonths] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  // Folder name → Health Status
  const healthMap = {
    'On_Track':         'On Track',
    'At_Risk':          'At Risk',
    'Attention_Needed': 'At Risk',
    'Overrun':          'Over Budget',
  };

  for (const l of leaves) {
    const title = path.basename(l.file, path.extname(l.file));
    const folder = l.segments[0] || '';
    const health = healthMap[folder] || 'On Track';
    const date = parseDateFromFilename(title);
    const props = {
      'Name':          { title: [{ text: { content: title.slice(0, 500) } }] },
      'Health Status': { select: { name: health } },
      'Month':         date ? { date: { start: date } } : undefined,
      'Project':       projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, title, { existingKeys, key: dupKey(projectPageId, title) });
    await sleep(250);
  }
}

async function importVariations(projectName, projectDir) {
  const dbId = DB_IDS[10];
  if (!dbId) return console.log('  ⚠ DB-10 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_3_COMMERCIAL_PERFORMANCE', 'DB-10_Variation_Register');
  const leaves = walkAllFiles(dir).slice(0, LIMIT);
  console.log(`\n[DB-10 Variations] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  // Folder → Reason select
  const reasonMap = {
    'Client_Instruction':      'Client Change',
    'Complexity_Increase':     'Design Dev',
    'Design_Change':           'Design Dev',
    'Drawing_Count_Increase':  'Scope Add',
    'Input_Change':            'Client Change',
    'New_Discipline_Added':    'Scope Add',
    'Scope_Addition':          'Scope Add',
  };

  for (const l of leaves) {
    const title = path.basename(l.file, path.extname(l.file));
    const folder = l.segments[0] || '';
    const reason = reasonMap[folder] || 'Scope Add';
    const date = parseDateFromFilename(title);
    const props = {
      'Name':        { title: [{ text: { content: title.slice(0, 500) } }] },
      'Reason':      { select: { name: reason } },
      'Status':      { select: { name: 'Submitted' } },
      'Raised Date': date ? { date: { start: date } } : undefined,
      'Project':     projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, title, { existingKeys, key: dupKey(projectPageId, title) });
    await sleep(250);
  }
}

async function importKPI(projectName, projectDir) {
  const dbId = DB_IDS[11];
  if (!dbId) return console.log('  ⚠ DB-11 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_3_COMMERCIAL_PERFORMANCE', 'DB-11_KPI_Dashboard');
  const leaves = walkAllFiles(dir).slice(0, LIMIT);
  console.log(`\n[DB-11 KPI] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  const kpiTypeMap = (folder, file) => {
    const s = (folder + ' ' + file).toLowerCase();
    if (s.includes('quality'))      return 'Quality';
    if (s.includes('production') || s.includes('productivity')) return 'Productivity';
    if (s.includes('timeliness'))   return 'Timeliness';
    if (s.includes('attendance'))   return 'Attendance';
    if (s.includes('teamwork'))     return 'Teamwork';
    if (s.includes('sheet'))        return 'Sheet KPI';
    if (s.includes('model'))        return 'Model KPI';
    if (s.includes('param'))        return 'Param KPI';
    return 'Productivity';
  };

  for (const l of leaves) {
    const title = path.basename(l.file, path.extname(l.file));
    const folder = l.segments[0] || '';
    const date = parseDateFromFilename(title);
    const props = {
      'Name':     { title: [{ text: { content: title.slice(0, 500) } }] },
      'KPI Type': { select: { name: kpiTypeMap(folder, title) } },
      'Month':    date ? { date: { start: date } } : undefined,
      'Project':  projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, title, { existingKeys, key: dupKey(projectPageId, title) });
    await sleep(250);
  }
}

async function importTimesheets(projectName, projectDir) {
  const dbId = DB_IDS[12];
  if (!dbId) return console.log('  ⚠ DB-12 ID missing, skipping');
  const dir = path.join(projectDir, 'TIER_3_COMMERCIAL_PERFORMANCE', 'DB-12_Timesheet_Register');
  const leaves = walkAllFiles(dir).slice(0, LIMIT);
  console.log(`\n[DB-12 Timesheets] ${projectName} — ${leaves.length} files`);
  if (!leaves.length) return;
  const projectPageId = DRY ? null : await getProjectPageId(projectName);
  const existingKeys = DRY ? new Set() : await buildExistingKeys(dbId, 'Name', 'Project');

  for (const l of leaves) {
    const title = path.basename(l.file, path.extname(l.file));
    const date = parseDateFromFilename(title);
    const props = {
      'Name':     { title: [{ text: { content: title.slice(0, 500) } }] },
      'Status':   { select: { name: 'Submitted' } },
      'Date':     date ? { date: { start: date } } : undefined,
      'Project':  projectPageId ? { relation: [{ id: projectPageId }] } : undefined,
    };
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);
    await createRow(dbId, props, title, { existingKeys, key: dupKey(projectPageId, title) });
    await sleep(250);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const projectFolders = fs.readdirSync(ROOT).filter(f => {
    const full = path.join(ROOT, f);
    if (!fs.statSync(full).isDirectory()) return false;
    // Accept any folder that has at least one Tier-X subfolder (so projects
    // without TIER_2 but with TIER_3 are still picked up).
    return fs.existsSync(path.join(full, 'TIER_1_MASTER_REGISTERS')) ||
           fs.existsSync(path.join(full, 'TIER_2_PRODUCTION_TRACKING')) ||
           fs.existsSync(path.join(full, 'TIER_3_COMMERCIAL_PERFORMANCE'));
  });
  console.log(`Found ${projectFolders.length} project folders under ${ROOT}`);

  const filtered = PROJ_F ? projectFolders.filter(p => p.toLowerCase().includes(PROJ_F.toLowerCase())) : projectFolders;
  console.log(`After project filter: ${filtered.length}`);
  if (DRY) console.log('(DRY RUN — nothing will be posted)');

  for (const folder of filtered) {
    const projectName = projectNameFromFolder(folder);
    const projectDir = path.join(ROOT, folder);
    console.log(`\n════ ${projectName} ════════════════════════════`);
    const dbMap = {
      '1':  importDeliverables,
      '3':  importInputs,
      '4':  importIssues,
      '5':  importComms,
      '6':  importDocuments,
      '7':  importModelUpdates,
      '8':  importCommercial,
      '9':  importManmonths,
      '10': importVariations,
      '11': importKPI,
      '12': importTimesheets,
    };
    const dbsToRun = DB_F ? [DB_F] : Object.keys(dbMap);
    for (const n of dbsToRun) {
      if (dbMap[n]) await dbMap[n](projectName, projectDir);
    }
  }

  console.log('\n\n✔ Done.');
  console.log(`   Created: ${_runStats.created}  |  Skipped (dup): ${_runStats.skipped}  |  Failed: ${_runStats.failed}`);
})().catch(e => { console.error(e); process.exit(1); });
