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
    const { type, status } = req.query; // type=lumpsum|resourcing, status=Active|Completed|...

    // Build filter
    const filters = [];
    if (type) {
      const billingModel = type === 'lumpsum' ? 'Lump Sum' : 'Resourcing';
      filters.push({ property: 'Billing Model', select: { equals: billingModel } });
    }
    if (status) {
      filters.push({ property: 'Status', select: { equals: status } });
    }

    const queryOptions = {
      database_id: process.env.NOTION_PROJECTS_DB,
      page_size: 100,
      sorts: [{ property: 'Project Name', direction: 'ascending' }]
    };

    if (filters.length === 1) queryOptions.filter = filters[0];
    else if (filters.length > 1) queryOptions.filter = { and: filters };

    const response = await notion.databases.query(queryOptions);

    const projects = response.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        name: p['Project Name']?.title?.[0]?.plain_text || 'Untitled',
        code: p['Project Code']?.rich_text?.[0]?.plain_text || '',
        billingModel: p['Billing Model']?.select?.name || '',
        status: p['Status']?.select?.name || '',
        stage: p['Current Stage']?.select?.name || '',
        progress: p['Overall Progress %']?.number || 0,
        client: p['Client Name']?.rich_text?.[0]?.plain_text || '',
        contractor: p['Contractor']?.rich_text?.[0]?.plain_text || '',
        location: p['Location/Region']?.select?.name || '',
        teamSize: p['Current Team Size']?.number || p['Team Size']?.number || 0,
        onsiteResources: p['Onsite Resources']?.number || 0,
        offsiteResources: p['Offsite Resources']?.number || 0,
        disciplines: p['Disciplines']?.multi_select?.map(d => d.name) || [],
        contractValue: p['Lumpsum Contract Value']?.number || 0,
        manmonthsBudgeted: p['Total Manmonths Budgeted']?.number || 0,
        manmonthsUsed: p['Cumulative Man-months Used']?.number || 0,
        cumulativeClaimValue: p['Cumulative Claim Value']?.number || 0,
        startDate: p['Start Date']?.date?.start || '',
        plannedEnd: p['Planned End Date']?.date?.start || '',
        actualEnd: p['Actual End Date']?.date?.start || '',
        totalDrawings: p['Total Drawings']?.number || 0,
        bepStatus: p['BEP Status']?.select?.name || '',
        midpStatus: p['MIDP Status']?.select?.name || '',
        deputationType: p['Deputation Type']?.select?.name || '',
        scopeDescription: p['Scope Description']?.rich_text?.[0]?.plain_text || '',
        zoneStructure: p['Zone Structure']?.rich_text?.[0]?.plain_text || '',
        remarks: p['Remarks']?.rich_text?.[0]?.plain_text || '',
      };
    });

    // Summary stats
    const summary = {
      total: projects.length,
      active: projects.filter(p => p.status === 'Active').length,
      completed: projects.filter(p => p.status === 'Completed').length,
      onHold: projects.filter(p => p.status === 'On Hold').length,
      lumpSum: projects.filter(p => p.billingModel === 'Lump Sum').length,
      resourcing: projects.filter(p => p.billingModel === 'Resourcing').length,
      totalContractValue: projects.reduce((sum, p) => sum + (p.contractValue || 0), 0),
      totalManmonthsBudgeted: projects.reduce((sum, p) => sum + (p.manmonthsBudgeted || 0), 0),
      totalManmonthsUsed: projects.reduce((sum, p) => sum + (p.manmonthsUsed || 0), 0),
      avgProgress: projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
        : 0
    };

    return res.status(200).json({ success: true, summary, projects });

  } catch (error) {
    console.error('Projects API error:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
};
