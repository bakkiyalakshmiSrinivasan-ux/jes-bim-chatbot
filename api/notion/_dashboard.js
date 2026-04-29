const { Client } = require('@notionhq/client');
const jwt = require('jsonwebtoken');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all projects
    const projectsRes = await notion.databases.query({
      database_id: process.env.NOTION_PROJECTS_DB,
      page_size: 100,
      filter: {
        property: 'Status',
        select: { does_not_equal: 'Cancelled' }
      }
    });

    const projects = projectsRes.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        name: p['Project Name']?.title?.[0]?.plain_text || '',
        code: p['Project Code']?.rich_text?.[0]?.plain_text || '',
        billingModel: p['Billing Model']?.select?.name || '',
        status: p['Status']?.select?.name || '',
        stage: p['Current Stage']?.select?.name || '',
        progress: p['Overall Progress %']?.number || 0,
        location: p['Location/Region']?.select?.name || '',
        teamSize: p['Team Size']?.number || 0,
        contractValue: p['Lumpsum Contract Value']?.number || 0,
        manmonthsBudgeted: p['Total Manmonths Budgeted']?.number || 0,
        manmonthsUsed: p['Cumulative Man-months Used']?.number || 0,
        disciplines: p['Disciplines']?.multi_select?.map(d => d.name) || [],
        client: p['Client Name']?.rich_text?.[0]?.plain_text || '',
        scope: p['Scope Description']?.rich_text?.[0]?.plain_text || '',
        onsiteResources: p['Onsite Resources']?.number || 0,
        offsiteResources: p['Offsite Resources']?.number || 0,
        totalDrawings: p['Total Drawings']?.number || 0,
        bepStatus: p['BEP Status']?.select?.name || '',
        midpStatus: p['MIDP Status']?.select?.name || '',
      };
    });

    // Compute dashboard cards
    const activeProjects = projects.filter(p => p.status === 'Active');
    const lumpSum = projects.filter(p => p.billingModel === 'Lump Sum');
    const resourcing = projects.filter(p => p.billingModel === 'Resourcing');

    const dashboard = {
      // KPI Cards
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

      // Chart: Projects by status
      byStatus: {
        Active: activeProjects.length,
        Completed: projects.filter(p => p.status === 'Completed').length,
        'On Hold': projects.filter(p => p.status === 'On Hold').length,
        Cancelled: projects.filter(p => p.status === 'Cancelled').length,
      },

      // Chart: Projects by billing model
      byBillingModel: {
        'Lump Sum': lumpSum.length,
        'Resourcing': resourcing.length,
      },

      // Chart: Projects by location
      byLocation: projects.reduce((acc, p) => {
        const loc = p.location || 'Unknown';
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
      }, {}),

      // Chart: Projects by stage
      byStage: activeProjects.reduce((acc, p) => {
        const stage = p.stage || 'Unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),

      // Chart: Progress per active project
      progressByProject: activeProjects.map(p => ({
        name: p.name,
        progress: p.progress,
        type: p.billingModel
      })),

      // Chart: Manmonth utilization per project
      manmonthsByProject: projects
        .filter(p => p.manmonthsBudgeted > 0)
        .map(p => ({
          name: p.name,
          budgeted: p.manmonthsBudgeted,
          used: p.manmonthsUsed,
          utilization: Math.round((p.manmonthsUsed / p.manmonthsBudgeted) * 100)
        })),

      // Chart: Disciplines distribution
      byDiscipline: projects.reduce((acc, p) => {
        p.disciplines.forEach(d => { acc[d] = (acc[d] || 0) + 1; });
        return acc;
      }, {}),
    };

    return res.status(200).json({ success: true, dashboard, projects });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard data' });
  }
};
