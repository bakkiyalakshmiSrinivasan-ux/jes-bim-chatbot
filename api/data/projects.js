const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── POST: create project in Notion DB-A ────────────────────────────────────
async function createNotionProject(data) {
  const { Client } = require('@notionhq/client');
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId   = process.env.NOTION_PROJECTS_DB;
  if (!dbId) throw new Error('NOTION_PROJECTS_DB not configured');

  const props = {
    'Name': { title: [{ text: { content: data.name || '' } }] },
  };
  if (data.code)            props['Code']            = { rich_text: [{ text: { content: data.code } }] };
  if (data.client)          props['Client']          = { rich_text: [{ text: { content: data.client } }] };
  if (data.billingModel)    props['Billing Model']   = { select: { name: data.billingModel } };
  if (data.status)          props['Status']          = { select: { name: data.status } };
  if (data.location)        props['Location']        = { select: { name: data.location } };
  if (data.disciplines && data.disciplines.length)
                            props['Disciplines']     = { multi_select: data.disciplines.map(d => ({ name: d })) };
  if (data.contractValue != null)
                            props['Contract Value']  = { number: data.contractValue };
  if (data.manmonthsBudgeted != null)
                            props['Manmonths Budgeted'] = { number: data.manmonthsBudgeted };

  return notion.pages.create({ parent: { database_id: dbId }, properties: props });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  // ── POST: add a new project ───────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Project name is required' });
      const page = await createNotionProject(req.body);
      return res.status(200).json({ success: true, pageId: page.id, message: `Project "${name}" added to Notion successfully` });
    } catch (err) {
      console.error('Add project error:', err);
      return res.status(500).json({ error: err.message || 'Failed to add project' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Delegate project-detail requests
  if (req.query && req.query.name) return require('./_project-detail')(req, res);

  try {
    // Read local JSON built from MASTER REGISTERS folder extraction
    const dataPath = path.join(process.cwd(), 'public', 'projects_data.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);

    const projects = data.projects.map(p => ({
      id: p.code || p.name,
      name: p.name,
      code: p.code,
      billingModel: p.billing_model,
      status: p.status,
      stage: p.stage,
      progress: p.progress,
      location: p.location,
      teamSize: p.team_size,
      contractValue: p.contract_value,
      manmonthsBudgeted: p.manmonths_budgeted,
      manmonthsUsed: p.manmonths_used,
      disciplines: p.disciplines || [],
      client: p.client,
      scope: p.scope,
      totalFiles: p.total_files,
      lastUpdated: p.last_updated,
    }));

    const activeProjects = projects.filter(p => p.status === 'Active');
    const lumpSum = projects.filter(p => p.billingModel === 'Lump Sum');
    const resourcing = projects.filter(p => p.billingModel === 'Resourcing');

    const dashboard = {
      cards: {
        totalProjects: projects.length,
        activeProjects: activeProjects.length,
        completedProjects: projects.filter(p => p.status === 'Completed').length,
        onHoldProjects: projects.filter(p => p.status === 'On Hold').length,
        lumpSumCount: lumpSum.length,
        resourcingCount: resourcing.length,
        totalTeamSize: projects.reduce((s, p) => s + p.teamSize, 0),
        avgProgress: activeProjects.length > 0
          ? Math.round(activeProjects.reduce((s, p) => s + p.progress, 0) / activeProjects.length)
          : 0,
        totalContractValue: lumpSum.reduce((s, p) => s + (p.contractValue || 0), 0),
        totalManmonthsBudgeted: projects.reduce((s, p) => s + (p.manmonthsBudgeted || 0), 0),
        totalManmonthsUsed: projects.reduce((s, p) => s + (p.manmonthsUsed || 0), 0),
      },
      byStatus: {
        Active: activeProjects.length,
        Completed: projects.filter(p => p.status === 'Completed').length,
        'On Hold': projects.filter(p => p.status === 'On Hold').length,
      },
      byBillingModel: {
        'Lump Sum': lumpSum.length,
        'Resourcing': resourcing.length,
      },
      byLocation: projects.reduce((acc, p) => {
        const loc = p.location || 'Unknown';
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
      }, {}),
      byStage: activeProjects.reduce((acc, p) => {
        const stage = p.stage || 'Unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),
      progressByProject: activeProjects.map(p => ({
        name: p.name,
        progress: p.progress,
        type: p.billingModel,
      })),
      manmonthsByProject: projects
        .filter(p => p.manmonthsBudgeted > 0)
        .map(p => ({
          name: p.name,
          budgeted: p.manmonthsBudgeted,
          used: p.manmonthsUsed,
          utilization: Math.round((p.manmonthsUsed / p.manmonthsBudgeted) * 100),
        })),
      byDiscipline: projects.reduce((acc, p) => {
        (p.disciplines || []).forEach(d => { acc[d] = (acc[d] || 0) + 1; });
        return acc;
      }, {}),
      generatedAt: data.generated_at,
      source: data.source,
    };

    return res.status(200).json({ success: true, dashboard, projects });

  } catch (error) {
    console.error('Local projects API error:', error);
    return res.status(500).json({ error: 'Failed to load local project data', details: error.message });
  }
};
