const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { Client } = require('@notionhq/client');
const { fetchAllResourcesLive } = require('./_googleSheets');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── DB ID for Resource Active & Inactive Tracker ──────────────────────────────
const RESOURCE_TRACKER_DB = process.env.NOTION_RESOURCE_TRACKER_DB || 'eaf583f113034aababf8bf13cf4ac250';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── Map a Notion page → resource object ──────────────────────────────────────
function mapNotionPage(page) {
  const p = page.properties;
  const get = (prop, type) => {
    if (!p[prop]) return null;
    if (type === 'title') return (p[prop].title || [])[0]?.plain_text || '';
    if (type === 'select') return p[prop].select?.name || null;
    if (type === 'text')   return (p[prop].rich_text || [])[0]?.plain_text || '';
    if (type === 'date')   return p[prop].date?.start || null;
    return null;
  };

  const name        = get('Employee Name', 'title');
  const status      = get('Status', 'select');
  const discipline  = get('Discipline', 'select');   // "Architecture" | "MEP - Electrical" etc.
  const designation = get('Designation', 'select');
  const department  = get('Department', 'select');
  const location    = get('Location', 'select') || 'Chennai';
  const reason      = get('Reason', 'select');
  const lastProject = get('Last Project', 'text');
  const notes       = get('Notes', 'text');

  // Derive discipline fields
  const isArch = discipline === 'Architecture';
  const discType = !isArch
    ? (discipline || '').replace('MEP - ', '')   // "Electrical" | "Mechanical" | "Plumbing"
    : null;

  // current_project: bench workers stored "Internal", active workers stored project name
  const currentProject = lastProject || 'Unassigned';

  // grade: map Designation option back to grade string
  const gradeMap = {
    'Project Manager': 'Projects Manager',
    'BIM Lead': 'BIM Lead',
    'BIM Coordinator': 'BIM Coordinator',
    'Sr. BIM Modeler': 'Senior BIM Modeler',
    'BIM Modeler': 'BIM Modeler',
    'Jr. BIM Modeler': 'Junior BIM Modeler',
    'Intern': 'Intern',
  };

  return {
    name,
    designation: designation || '',
    grade: gradeMap[designation] || designation || '',
    discipline: isArch ? 'Arch' : 'MEP',
    discipline_type: discType,
    department: department || (isArch ? 'Architecture' : discType),
    location,
    current_project: currentProject,
    status,
    reason,
    notes: notes || '',
    page_id: page.id,
  };
}

// ── Fetch all resources from Notion (handles pagination) ──────────────────────
async function fetchFromNotion() {
  const all = [];
  let cursor = undefined;

  do {
    const resp = await notion.databases.query({
      database_id: RESOURCE_TRACKER_DB,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        property: 'Status',
        select: { does_not_equal: 'Terminated' },  // exclude terminated
      },
    });
    resp.results.forEach(page => {
      const r = mapNotionPage(page);
      if (r.name) all.push(r);
    });
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  return all;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let all = [];
    let source = 'local';
    const refresh = String(req.query?.refresh || '') === '1';

    // ── PRIMARY: live Google Sheets (if GOOGLE_SHEETS_API_KEY is set) ────────
    if (process.env.GOOGLE_SHEETS_API_KEY) {
      try {
        const live = await fetchAllResourcesLive({ force: refresh });
        all = [...live.arch, ...live.mep];
        source = 'google-sheets';
      } catch (liveErr) {
        console.warn('Google Sheets live fetch failed, falling back:', liveErr.message);
      }
    }

    // ── SECONDARY: local resources_data.json snapshot ────────────────────────
    if (all.length === 0) {
      try {
        const dataPath = path.join(process.cwd(), 'public', 'resources_data.json');
        const raw = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(raw);
        const archLocal = (data.arch_resources || []).map(r => ({ ...r, discipline: 'Arch' }));
        const mepLocal  = (data.mep_resources  || []).map(r => ({ ...r, discipline: 'MEP' }));
        all = [...archLocal, ...mepLocal];
        source = 'local';
      } catch (localErr) {
        // ── TERTIARY: Notion Resource Tracker ─────────────────────────────────
        console.warn('Local JSON failed, falling back to Notion:', localErr.message);
        source = 'notion';
        try {
          all = await fetchFromNotion();
        } catch (notionErr) {
          console.warn('Notion fetch also failed:', notionErr.message);
        }
      }
    }

    // ── Split into Arch / MEP ─────────────────────────────────────────────────
    const arch = all.filter(r => r.discipline === 'Arch');
    const mep  = all.filter(r => r.discipline === 'MEP');

    // ── Compute summaries ─────────────────────────────────────────────────────
    const grades = all.reduce((acc, r) => {
      const g = r.grade || r.designation || 'Unknown';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});

    const byProject = all.reduce((acc, r) => {
      const p = r.current_project || 'Unassigned';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    const byLocation = all.reduce((acc, r) => {
      const loc = r.location || 'Chennai';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    const byStatus = all.reduce((acc, r) => {
      const s = r.status || 'Active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const bench = all.filter(r =>
      (r.current_project || '').toLowerCase() === 'internal' ||
      (r.reason || '') === 'Bench - Available'
    ).length;

    return res.status(200).json({
      success: true,
      source,
      summary: {
        total: all.length,
        arch: arch.length,
        mep: mep.length,
        bench,
        active: all.length - bench,
        grades,
        byProject,
        byLocation,
        byStatus,
      },
      arch_resources: arch,
      mep_resources: mep,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Resources API error:', error);
    return res.status(500).json({ error: 'Failed to load resource data', details: error.message });
  }
};
