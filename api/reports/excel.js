const { Client } = require('@notionhq/client');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

async function fetchProjects(filter) {
  const queryOpts = { database_id: process.env.NOTION_PROJECTS_DB, page_size: 100 };
  if (filter) queryOpts.filter = filter;
  const res = await notion.databases.query(queryOpts);
  return res.results.map(page => {
    const p = page.properties;
    return {
      'Project Name':     p['Project Name']?.title?.[0]?.plain_text || '',
      'Project Code':     p['Project Code']?.rich_text?.[0]?.plain_text || '',
      'Billing Model':    p['Billing Model']?.select?.name || '',
      'Status':           p['Status']?.select?.name || '',
      'Stage':            p['Current Stage']?.select?.name || '',
      'Progress (%)':     p['Overall Progress %']?.number || 0,
      'Client':           p['Client Name']?.rich_text?.[0]?.plain_text || '',
      'Location':         p['Location/Region']?.select?.name || '',
      'Team Size':        p['Current Team Size']?.number || 0,
      'Disciplines':      (p['Disciplines']?.multi_select || []).map(d => d.name).join(', '),
      'Contract Value (AED)': p['Lumpsum Contract Value']?.number || 0,
      'MM Budgeted':      p['Total Manmonths Budgeted']?.number || 0,
      'MM Used':          p['Cumulative Man-months Used']?.number || 0,
      'MM Utilisation (%)': p['Total Manmonths Budgeted']?.number
        ? Math.round(((p['Cumulative Man-months Used']?.number || 0) / p['Total Manmonths Budgeted']?.number) * 100)
        : 0,
      'Total Drawings':   p['Total Drawings']?.number || 0,
      'BEP Status':       p['BEP Status']?.select?.name || '',
      'MIDP Status':      p['MIDP Status']?.select?.name || '',
      'Start Date':       p['Start Date']?.date?.start || '',
      'Planned End':      p['Planned End Date']?.date?.start || '',
    };
  });
}

function styleWorksheet(ws, projects) {
  // Column widths
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
    { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 13 },
  ];
  return ws;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role === 'Viewer') return res.status(403).json({ error: 'Viewers cannot generate reports.' });

  try {
    const { reportType = 'all', billingModelFilter, projectFilter } = req.body;

    // Build Notion filter
    const filters = [];
    if (billingModelFilter) filters.push({ property: 'Billing Model', select: { equals: billingModelFilter } });
    if (projectFilter)      filters.push({ property: 'Status',        select: { equals: projectFilter } });
    const notionFilter = filters.length === 1 ? filters[0]
      : filters.length > 1 ? { and: filters } : undefined;

    const projects = await fetchProjects(notionFilter);
    const dateStr = new Date().toISOString().split('T')[0];

    // Create workbook
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Summary ──────────────────────────────────────────────
    const active    = projects.filter(p => p['Status'] === 'Active');
    const lumpSum   = projects.filter(p => p['Billing Model'] === 'Lump Sum');
    const resourcing= projects.filter(p => p['Billing Model'] === 'Resourcing');
    const totalMM_B = projects.reduce((s, p) => s + (p['MM Budgeted'] || 0), 0);
    const totalMM_U = projects.reduce((s, p) => s + (p['MM Used']     || 0), 0);

    const summaryData = [
      ['JES BIM Operations — Report Summary', '', '', ''],
      [`Generated: ${dateStr}`, '', '', ''],
      ['', '', '', ''],
      ['METRIC', 'VALUE', '', ''],
      ['Total Projects',        projects.length,  '', ''],
      ['Active Projects',       active.length,    '', ''],
      ['Lump Sum Projects',     lumpSum.length,   '', ''],
      ['Resourcing Projects',   resourcing.length,'', ''],
      ['Avg Progress (%)',
        active.length ? Math.round(active.reduce((s,p)=>s+p['Progress (%)'],0)/active.length) : 0,
        '', ''],
      ['Total Team Size',       active.reduce((s,p)=>s+p['Team Size'],0), '', ''],
      ['Total MM Budgeted',     totalMM_B,        '', ''],
      ['Total MM Used',         totalMM_U,        '', ''],
      ['Overall MM Utilisation (%)',
        totalMM_B ? Math.round((totalMM_U/totalMM_B)*100) : 0, '', ''],
      ['Total Contract Value (AED)', lumpSum.reduce((s,p)=>s+(p['Contract Value (AED)']||0),0), '', ''],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ── Sheet 2: All Projects ─────────────────────────────────────────
    const wsAll = XLSX.utils.json_to_sheet(projects);
    styleWorksheet(wsAll, projects);
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Projects');

    // ── Sheet 3: Lump Sum ─────────────────────────────────────────────
    if (lumpSum.length > 0) {
      const wsLS = XLSX.utils.json_to_sheet(lumpSum);
      styleWorksheet(wsLS, lumpSum);
      XLSX.utils.book_append_sheet(wb, wsLS, 'Lump Sum');
    }

    // ── Sheet 4: Resourcing ───────────────────────────────────────────
    if (resourcing.length > 0) {
      const wsRS = XLSX.utils.json_to_sheet(resourcing);
      styleWorksheet(wsRS, resourcing);
      XLSX.utils.book_append_sheet(wb, wsRS, 'Resourcing');
    }

    // ── Sheet 5: Man-Month Analysis ───────────────────────────────────
    const mmData = projects
      .filter(p => p['MM Budgeted'] > 0)
      .map(p => ({
        'Project': p['Project Name'],
        'Billing': p['Billing Model'],
        'MM Budgeted': p['MM Budgeted'],
        'MM Used': p['MM Used'],
        'MM Remaining': (p['MM Budgeted'] || 0) - (p['MM Used'] || 0),
        'Utilisation (%)': p['MM Utilisation (%)'],
        'Status': p['MM Utilisation (%)'] > 90 ? '⚠ Over Budget' :
                  p['MM Utilisation (%)'] > 75 ? '! At Risk' : '✓ On Track',
      }))
      .sort((a, b) => b['Utilisation (%)'] - a['Utilisation (%)']);

    if (mmData.length > 0) {
      const wsMM = XLSX.utils.json_to_sheet(mmData);
      wsMM['!cols'] = [{ wch:30},{wch:14},{wch:14},{wch:10},{wch:14},{wch:16},{wch:14}];
      XLSX.utils.book_append_sheet(wb, wsMM, 'Man-Month Analysis');
    }

    // Write to buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `JES_BIM_Report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buf);

  } catch (error) {
    console.error('Excel generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate Excel report' });
  }
};
