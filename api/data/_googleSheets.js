/**
 * Google Sheets → Resource Allocation fetcher
 *
 * Pulls live data from:
 *   - Sheet 1 (Arch): 2026 Arch- Resource Allocation Forecast, tab "Weekly resource allocation 2026"
 *   - Sheet 2 (MEP):  MEP Manmonths, tab "Total MEP"
 *
 * Auth: Google Sheets API v4 via API key (requires each sheet to be
 * shared "Anyone with the link — Viewer").
 *
 * Env var: GOOGLE_SHEETS_API_KEY
 */

const ARCH_SHEET_ID = '115D5_ZgLlVhDdmpDHuHa0KD_uS6rxECYBDNMlvXIOpg';
const ARCH_TAB      = 'Weekly resource allocation 2026';

const MEP_SHEET_ID  = '1wB5JFs0CESu5WTqZq_2Nl01AuCHpdp7A-jF7pMNan6Y';
const MEP_TAB       = 'Total MEP';

// ── Low-level fetcher ─────────────────────────────────────────────────────────
async function fetchRange(sheetId, range) {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!key) throw new Error('GOOGLE_SHEETS_API_KEY not set');

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?key=${key}&valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets API ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.values || [];
}

// ── Week-label matcher: finds the column whose header best matches today ─────
function findCurrentWeekCol(headerRow, today = new Date()) {
  // Header cells look like "April week 1 (1-4)", "May week 2 (4-10)", etc.
  const month = today.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day   = today.getDate();

  let bestIdx = -1;
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || '').toLowerCase();
    if (!cell.includes(month)) continue;
    // Extract range in parentheses e.g. "(12-18)"
    const m = cell.match(/\((\d+)\s*-\s*(\d+)\)/);
    if (!m) continue;
    const lo = parseInt(m[1], 10);
    const hi = parseInt(m[2], 10);
    if (day >= lo && day <= hi) return i;
    // Keep track of the latest matching month col as a fallback
    bestIdx = i;
  }
  return bestIdx;
}

// ── Parse Arch sheet (weekly columns, derive current_project by date) ────────
async function fetchArchResources() {
  // Row 11 is the header; data starts at row 12. Pull a wide range.
  const rows = await fetchRange(ARCH_SHEET_ID, `'${ARCH_TAB}'!A11:BZ300`);
  if (!rows.length) return [];

  const header = rows[0];
  const currentCol = findCurrentWeekCol(header);

  // Column indexes (based on observed layout)
  const COL_TEAM        = 0; // A
  const COL_NAME        = 1; // B
  const COL_DESIGNATION = 2; // C
  const COL_BATCH       = 4; // E
  const COL_LOCATION    = 5; // F

  const resources = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (row[COL_NAME] || '').trim();
    if (!name) continue;

    const currentProject = currentCol >= 0
      ? (row[currentCol] || '').trim() || 'Unassigned'
      : 'Unassigned';

    const onBench = !currentProject
      || /^internal$/i.test(currentProject)
      || currentProject === 'Unassigned';

    resources.push({
      name,
      team:            (row[COL_TEAM] || '').trim(),
      designation:     (row[COL_DESIGNATION] || '').trim(),
      grade:           (row[COL_DESIGNATION] || '').trim(),
      location:        (row[COL_LOCATION] || 'Chennai').trim(),
      batch:           (row[COL_BATCH] || '').trim(),
      current_project: currentProject,
      discipline:      'Arch',
      on_bench:        onBench,
    });
  }
  return resources;
}

// ── Parse MEP sheet (has explicit "Current Allocated Project" column) ────────
async function fetchMepResources() {
  const rows = await fetchRange(MEP_SHEET_ID, `'${MEP_TAB}'!A1:BZ300`);
  if (!rows.length) return [];

  const header = rows[0].map(h => String(h || '').trim().toLowerCase());

  // Locate columns by header text (more robust than fixed indexes)
  const findCol = (...needles) => {
    for (let i = 0; i < header.length; i++) {
      if (needles.some(n => header[i].includes(n))) return i;
    }
    return -1;
  };
  const COL_NAME           = findCol('resource');
  const COL_DESIGNATION    = findCol('designation');  // first designation col
  const COL_BATCH          = findCol('batch');
  const COL_LOCATION       = findCol('location');
  const COL_CURRENT_PROJECT = findCol('current allocated project', 'current project');

  const resources = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const nameRaw = (row[COL_NAME] || '').trim();
    if (!nameRaw) continue;

    // Name cell may contain "(Resigned)" suffix — strip for display but keep a flag
    const resigned = /\(resigned\)/i.test(nameRaw);
    const name = nameRaw.replace(/\s*\(resigned\)\s*/i, '').trim();

    const currentProject = (row[COL_CURRENT_PROJECT] || '').trim() || 'Unassigned';
    const onBench = !currentProject
      || /^internal$/i.test(currentProject)
      || /^unallocated$/i.test(currentProject)
      || currentProject === 'Unassigned';

    resources.push({
      name,
      resigned,
      designation:     (row[COL_DESIGNATION] || '').trim(),
      grade:           (row[COL_DESIGNATION] || '').trim(),
      location:        (row[COL_LOCATION] || 'Chennai').trim(),
      batch:           (row[COL_BATCH] || '').trim(),
      current_project: currentProject,
      discipline:      'MEP',
      team:            '',
      on_bench:        onBench,
    });
  }
  return resources;
}

// ── In-memory cache (serverless instance lifetime ~ 5 min) ───────────────────
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchAllResourcesLive({ force = false } = {}) {
  if (!force && _cache && Date.now() - _cacheAt < CACHE_TTL_MS) {
    return _cache;
  }
  const [arch, mep] = await Promise.all([
    fetchArchResources(),
    fetchMepResources(),
  ]);
  _cache = { arch, mep, fetched_at: new Date().toISOString() };
  _cacheAt = Date.now();
  return _cache;
}

module.exports = { fetchAllResourcesLive };
