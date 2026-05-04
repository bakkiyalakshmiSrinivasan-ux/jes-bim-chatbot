const { Client } = require('@notionhq/client');
const jwt = require('jsonwebtoken');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

async function queryAllPages(database_id, filter) {
  // NOTE: no server-side sort — KPI Daily Log is a multi-source Notion DB
  // and legacy databases.query can't resolve property-based sorts. Caller
  // can sort results in JS by the `date` field if needed.
  const results = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id,
      filter,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    });
    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return results;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { start_date, end_date, project, kpi_type } = req.query;

    // NOTE: KPI DB is multi-source — legacy databases.query cannot resolve
    // property-based filters or sorts. Pull everything and filter in JS.
    const pages = await queryAllPages(process.env.NOTION_KPI_DB, undefined);

    let kpis = pages.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        name: p['Name']?.title?.[0]?.plain_text || '',
        date: p['Date']?.date?.start || '',
        project: p['Project']?.select?.name || '',
        staffName: p['Staff Name']?.rich_text?.[0]?.plain_text || '',
        kpiType: p['KPI Type']?.select?.name || '',
        kpiValue: p['KPI Value']?.number ?? null,
        dayStatus: p['Day Status']?.select?.name || '',
        packageDiscipline: p['Package/Discipline']?.rich_text?.[0]?.plain_text || '',
        manager: p['Manager']?.rich_text?.[0]?.plain_text || '',
        coordinator: p['Coordinator']?.rich_text?.[0]?.plain_text || '',
        updatedAt: p['Updated At']?.rich_text?.[0]?.plain_text || ''
      };
    });

    // Apply filters in JS (multi-source DB — can't filter server-side)
    if (start_date) kpis = kpis.filter(k => k.date && k.date >= start_date);
    if (end_date)   kpis = kpis.filter(k => k.date && k.date <= end_date);
    if (project && project !== 'all')   kpis = kpis.filter(k => k.project === project);
    if (kpi_type && kpi_type !== 'all') kpis = kpis.filter(k => k.kpiType === kpi_type);

    // Sort by date ascending
    kpis.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Build summary stats grouped by project
    const projectSummary = {};
    for (const k of kpis) {
      if (!projectSummary[k.project]) {
        projectSummary[k.project] = {
          project: k.project,
          totalRecords: 0,
          presentDays: 0,
          holidayDays: 0,
          staffSet: new Set(),
          kpiByType: { 'Model KPI': [], 'Sheet KPI': [], 'Parameter KPI': [] },
          dates: new Set()
        };
      }
      const s = projectSummary[k.project];
      s.totalRecords++;
      if (k.dayStatus === 'Present') s.presentDays++;
      if (k.dayStatus === 'Holiday') s.holidayDays++;
      if (k.staffName) s.staffSet.add(k.staffName);
      if (k.kpiType && k.kpiValue !== null) s.kpiByType[k.kpiType]?.push(k.kpiValue);
      if (k.date) s.dates.add(k.date);
    }

    // Convert sets to arrays/counts for JSON
    const summary = Object.values(projectSummary).map(s => ({
      project: s.project,
      totalRecords: s.totalRecords,
      presentDays: s.presentDays,
      holidayDays: s.holidayDays,
      uniqueStaff: s.staffSet.size,
      dates: [...s.dates].sort(),
      kpiAverages: {
        'Model KPI': s.kpiByType['Model KPI'].length
          ? (s.kpiByType['Model KPI'].reduce((a, b) => a + b, 0) / s.kpiByType['Model KPI'].length).toFixed(2)
          : null,
        'Sheet KPI': s.kpiByType['Sheet KPI'].length
          ? (s.kpiByType['Sheet KPI'].reduce((a, b) => a + b, 0) / s.kpiByType['Sheet KPI'].length).toFixed(2)
          : null,
        'Parameter KPI': s.kpiByType['Parameter KPI'].length
          ? (s.kpiByType['Parameter KPI'].reduce((a, b) => a + b, 0) / s.kpiByType['Parameter KPI'].length).toFixed(2)
          : null
      }
    }));

    return res.status(200).json({
      success: true,
      count: kpis.length,
      dateRange: { start: start_date || null, end: end_date || null },
      summary,
      kpis
    });

  } catch (error) {
    console.error('KPI API error:', error);
    return res.status(500).json({ error: 'Failed to fetch KPI data', detail: error.message });
  }
};
