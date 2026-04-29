/**
 * v2 Report Template Endpoint
 *
 * GET /api/reports/v2-template?type=<reportType>&project=<projectName>
 *
 * Generates a PDF (or HTML fallback) report from live v2 SSOT Hub data.
 *
 * Supported report types:
 *   - monthly       (Monthly Progress Report)
 *   - kpi           (Employee KPI Report)
 *   - efficiency    (Manmonth Efficiency Report)
 *   - payment-cert  (Payment Certificate)
 *   - variation     (Variation Claim Compiler)
 *
 * Data source: All v2 Notion DBs (DB-A through DB-12) via _notionDbs.js
 * PDF engine:  puppeteer-core + @sparticuz/chromium (same as api/reports/pdf.js)
 *               with HTML fallback if puppeteer not available.
 */

const jwt = require('jsonwebtoken');
const notionDbs = require('../data/_notionDbs.js');
const tpl = require('./_v2_templates.js');

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

const TEMPLATE_MAP = {
  'monthly':      { fn: tpl.monthlyProgressHtml, label: 'Monthly Progress Report' },
  'kpi':          { fn: tpl.employeeKpiHtml,     label: 'Employee KPI Report' },
  'efficiency':   { fn: tpl.efficiencyHtml,      label: 'Manmonth Efficiency Report' },
  'payment-cert': { fn: tpl.paymentCertHtml,     label: 'Payment Certificate' },
  'variation':    { fn: tpl.variationHtml,       label: 'Variation Claim Compiler' },
};

async function gatherProjectData(projectName) {
  // Pull project + all related DBs in parallel
  const projects = await notionDbs.fetchProjects();
  const project = projects.find(p =>
    (p.name || '').toLowerCase().trim() === (projectName || '').toLowerCase().trim()
  ) || projects.find(p => (p.name || '').toLowerCase().includes((projectName || '').toLowerCase()));
  if (!project) throw new Error(`Project not found: ${projectName}`);

  const [team, deliverables, schedule, inputs, issues, comms, documents, modelUpdates,
         commercial, manmonths, variations, kpi, timesheets] = await Promise.all([
    notionDbs.fetchPeople().catch(() => []).then(all => all.filter(p =>
      (p.lastProject || '').toLowerCase().includes(projectName.toLowerCase()))),
    notionDbs.fetchDeliverables(projectName).catch(() => []),
    notionDbs.fetchSchedule(projectName).catch(() => []),
    notionDbs.fetchInputs(projectName).catch(() => []),
    notionDbs.fetchIssues(projectName).catch(() => []),
    notionDbs.fetchComms(projectName).catch(() => []),
    notionDbs.fetchDocuments(projectName).catch(() => []),
    notionDbs.fetchModelUpdates(projectName).catch(() => []),
    notionDbs.fetchCommercial(projectName).catch(() => []),
    notionDbs.fetchManmonths(projectName).catch(() => []),
    notionDbs.fetchVariations(projectName).catch(() => []),
    notionDbs.fetchKPI(projectName).catch(() => []),
    notionDbs.fetchTimesheets(projectName).catch(() => []),
  ]);

  // Normalise manmonth shape for templates (the templates expect budgetedMM/consumedMM/cumulativeConsumed/etc.)
  const manmonthsNormalized = manmonths.map(m => ({
    employee: m.employee,
    month:    m.month,
    budgetedMM:        m.plannedHours != null ? m.plannedHours / 160 : null,
    consumedMM:        m.actualHours  != null ? m.actualHours  / 160 : null,
    cumulativeConsumed: m.cumulativeConsumed,
    actualPct:         m.actualProgress,
    health:            m.healthStatus,
  }));

  return {
    project, team, deliverables, schedule, inputs, issues, comms, documents,
    modelUpdates, commercial, manmonths: manmonthsNormalized, variations, kpi, timesheets,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  // Optional auth
  if (process.env.JWT_SECRET) {
    const decoded = verifyToken(req);
    if (!decoded && req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
  }

  const params = req.method === 'GET' ? req.query : (req.body || {});
  const reportType = (params.type || 'monthly').toLowerCase();
  const projectName = params.project || params.projectName;
  const wantHtml    = (params.format || '').toLowerCase() === 'html';

  if (!projectName) return res.status(400).json({ error: 'project parameter required' });
  const tpldef = TEMPLATE_MAP[reportType];
  if (!tpldef) return res.status(400).json({ error: `Unknown report type: ${reportType}. Supported: ${Object.keys(TEMPLATE_MAP).join(', ')}` });

  try {
    const data = await gatherProjectData(projectName);
    const html = tpldef.fn(data);

    if (wantHtml) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // Try server-side PDF via puppeteer
    let pdfBuffer;
    try {
      const chromium  = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({ format: 'A4', printBackground: true,
                                    margin: { top:'0', right:'0', bottom:'15mm', left:'0' } });
      await browser.close();
    } catch (e) {
      console.warn('Puppeteer unavailable, returning HTML for client-side PDF:', e.message);
      return res.status(200).json({
        success: true, fallback: true, html, label: tpldef.label,
        message: 'PDF generation not available server-side. Render HTML in browser and print to PDF.',
      });
    }

    const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const filename = `JES_BIM_${slug(data.project.name)}_${slug(tpldef.label)}_${new Date().toISOString().slice(0,10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error('v2 report generation error:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};
