/**
 * Project Detail endpoint — GET /api/data/project-detail?name=H2R
 *
 * Aggregates everything about a single project into one response:
 *   - Base info from DB-A Projects Master (+ local JSON fallback)
 *   - Team members from DB-B People & Resources (filtered by current_project)
 *   - Deliverables from DB-1
 *   - Schedule & milestones from DB-2
 *   - Inputs & prerequisites from DB-3
 *   - RFIs / Issues / Clashes from DB-4
 *   - Communications from DB-5
 *   - Documents from DB-6
 *   - Model updates from DB-7
 *   - Commercial / invoices from DB-8
 *   - Manmonths from DB-9
 *   - Variations from DB-10
 *   - KPI entries from DB-11 (filtered by project)
 *   - Timesheets from DB-12
 *
 * Every section is fetched in parallel so the endpoint stays fast.
 * Sections that fail (missing DB ID, permissions) return [] — not an error.
 */

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const notionDbs = require('./_notionDbs');

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

function loadLocalProject(name) {
  try {
    const p = path.join(process.cwd(), 'public', 'projects_data.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const q = (name || '').toLowerCase();
    return (d.projects || []).find(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.code || '').toLowerCase() === q) || null;
  } catch { return null; }
}

function loadLocalTeam(projectName) {
  try {
    const p = path.join(process.cwd(), 'public', 'resources_data.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const pn = (projectName || '').toLowerCase();
    const all = [...(d.arch_resources || []), ...(d.mep_resources || [])];
    return all.filter(r => {
      const cp = (r.current_project || '').toLowerCase();
      return cp && pn && (cp.includes(pn) || pn.includes(cp));
    });
  } catch { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const projectName = (req.query?.name || '').trim();
  if (!projectName) return res.status(400).json({ error: 'name query param required' });

  try {
    // ── Pull everything in parallel ─────────────────────────────────────────
    const wants = {
      projects: true, people: true,
      deliverables: true, schedule: true, inputs: true, issues: true,
      comms: true, documents: true, modelUpdates: true,
      commercial: true, manmonths: true, variations: true,
      kpi: true, timesheets: true,
    };
    const notionData = await notionDbs.fetchRelevant({ projectName, wants }).catch(e => {
      console.warn('Notion fetch (project-detail) failed:', e.message);
      return {};
    });

    // ── Resolve base project info (Notion DB-A first, local JSON fallback) ─
    const projectsAll = notionData.projects || [];
    let project = projectsAll.find(p =>
      (p.name || '').toLowerCase().includes(projectName.toLowerCase()) ||
      (p.code || '').toLowerCase() === projectName.toLowerCase()
    );
    if (!project) project = loadLocalProject(projectName);

    // ── Team members (Notion DB-B filtered + local JSON) ────────────────────
    let team = (notionData.people || []).filter(p =>
      (p.lastProject || '').toLowerCase().includes(projectName.toLowerCase()));
    if (!team.length) team = loadLocalTeam(projectName);

    // ── Summary stats for quick rendering ───────────────────────────────────
    const deliverables = notionData.deliverables || [];
    const schedule     = notionData.schedule || [];
    const issues       = notionData.issues || [];
    const variations   = notionData.variations || [];
    const commercial   = notionData.commercial || [];
    const manmonths    = notionData.manmonths || [];
    const timesheets   = notionData.timesheets || [];

    const summary = {
      teamSize:          team.length,
      deliverablesTotal: deliverables.length,
      deliverablesApproved: deliverables.filter(d => /approved/i.test(d.status || '')).length,
      openIssues:        issues.filter(i => !/closed|resolved/i.test(i.status || '')).length,
      variationsTotal:   variations.length,
      variationsCostImpact: variations.reduce((s, v) => s + (v.costImpact || 0), 0),
      invoiceCount:      commercial.length,
      invoiceTotal:      commercial.reduce((s, c) => s + (c.amount || 0), 0),
      manmonthsPlanned:  manmonths.reduce((s, m) => s + (m.plannedHours || 0), 0) / 160,
      manmonthsActual:   manmonths.reduce((s, m) => s + (m.actualHours  || 0), 0) / 160,
      timesheetHours:    timesheets.reduce((s, t) => s + (t.hours || 0), 0),
      openInputs:        (notionData.inputs || []).filter(i => !/received|done|complete/i.test(i.status || '')).length,
    };

    return res.status(200).json({
      success: true,
      project: project || { name: projectName, _notFound: true },
      summary,
      team,
      deliverables,
      schedule,
      inputs: notionData.inputs || [],
      issues,
      comms: notionData.comms || [],
      documents: notionData.documents || [],
      modelUpdates: notionData.modelUpdates || [],
      commercial,
      manmonths,
      variations,
      kpi: notionData.kpi || [],
      timesheets,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Project detail error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load project detail' });
  }
};
