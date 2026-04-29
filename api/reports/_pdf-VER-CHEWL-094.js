const jwt = require('jsonwebtoken');

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ============================================================
// JES BIM Master Template Pack — v1.0 brand palette
// Lump-Sum reports use the blue theme; Resourcing reports
// use the emerald theme. Matches Master Template Pack v1.0.
// ============================================================
const THEMES = {
  'lump-sum': {
    primary:       '#1e3a8a', // deep indigo
    primaryDark:   '#172554',
    primarySoft:   '#e0e7ff', // light blue section shade
    tableHeader:   '#1e3a8a',
    tableAltRow:   '#f5f7ff',
    bannerLabelL:  'JES BIM OPERATIONS',
    footerLine:    'Confidential &mdash; JES BIM Operations',
  },
  'resourcing': {
    primary:       '#047857', // emerald-700
    primaryDark:   '#064e3b',
    primarySoft:   '#d1fae5',
    tableHeader:   '#047857',
    tableAltRow:   '#f0fdf4',
    bannerLabelL:  'JES BIM &mdash; RESOURCING',
    footerLine:    'Confidential &mdash; JES BIM Operations',
  },
};

// Map common report types to a default banner label + theme kind.
// The API still accepts explicit `kind` / `reportLabel` overrides.
const TYPE_PRESETS = {
  // Part A — Lump-Sum
  'invoice':            { kind: 'lump-sum',  label: 'Invoice (PA)' },
  'progress':           { kind: 'lump-sum',  label: 'Progress Report' },
  'manmonth':           { kind: 'lump-sum',  label: 'Manmonth Report' },
  'employee-kpi':       { kind: 'lump-sum',  label: 'Employee KPI' },
  'variation':          { kind: 'lump-sum',  label: 'Variation Report' },
  'kickoff':            { kind: 'lump-sum',  label: 'Kickoff Document' },
  'portfolio':          { kind: 'lump-sum',  label: 'Portfolio Summary' },
  'kpi':                { kind: 'lump-sum',  label: 'KPI Dashboard' },
  'bench':              { kind: 'lump-sum',  label: 'Bench Report' },
  'attendance':         { kind: 'lump-sum',  label: 'Attendance Report' },
  'status':             { kind: 'lump-sum',  label: 'Progress Report' },
  'all':                { kind: 'lump-sum',  label: 'Portfolio Summary' },
  // Part B — Resourcing
  'resourcing-invoice': { kind: 'resourcing', label: 'Resourcing Invoice (PA)' },
  'resourcing-monthly': { kind: 'resourcing', label: 'Resourcing Monthly Report' },
  'resource-util':      { kind: 'resourcing', label: 'Resource Utilization' },
  'resourcing-kpi':     { kind: 'resourcing', label: 'Resourcing KPI' },
  'resource-variation': { kind: 'resourcing', label: 'Resource Variation' },
  'portfolio-resource': { kind: 'resourcing', label: 'Portfolio Resourcing Summary' },
};

/**
 * Render markdown-ish report content into template-pack-styled HTML.
 * The visual layout mirrors JES_BIM_Master_Template_Pack.pdf v1.0:
 *   - 80px colored banner bar (blue / green) with left & right labels
 *   - Large bold title block in the theme color + subtitle
 *   - Section headings in the theme color
 *   - Tables with colored header row + alternating row tint
 *   - Footer strip: "Confidential — JES BIM Operations · Template v1.0 · Page N"
 */
function renderHTML(markdown, { title, subtitle, kind, reportLabel }) {
  const theme = THEMES[kind] || THEMES['lump-sum'];

  let html = markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="section-title">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Lists
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>');

  // Markdown table -> HTML table (must run BEFORE \n -> <br>)
  html = html.replace(/\|(.+)\|\n\|[-|: ]+\|\n((?:\|.+\|\n?)+)/g, (match, header, body) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="tp-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Paragraph/line breaks (run AFTER tables so \n is still present for table regex)
  html = html
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap consecutive <li> runs inside <ul>
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, (m) => `<ul>${m}</ul>`);

  const bannerLeft  = theme.bannerLabelL;
  const bannerRight = (reportLabel || 'Report').replace(/&/g, '&amp;');
  const safeTitle   = (title    || 'Report').replace(/&/g, '&amp;');
  const safeSubtl   = (subtitle || '').replace(/&/g, '&amp;');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #0f172a;
    margin: 0;
    padding: 0;
  }

  /* -------- Banner bar (matches template pack header strip) -------- */
  .banner {
    background: ${theme.primary};
    color: #ffffff;
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10pt;
    letter-spacing: 0.04em;
    font-weight: 700;
    text-transform: none;
  }
  .banner .right { font-weight: 500; opacity: 0.95; }

  /* -------- Page content area -------- */
  .page {
    padding: 28px 40px 90px 40px;
  }

  /* -------- Title block -------- */
  .title {
    font-size: 22pt;
    font-weight: 800;
    color: ${theme.primary};
    margin: 18px 0 4px 0;
    line-height: 1.15;
  }
  .subtitle {
    font-size: 10pt;
    color: #334155;
    margin: 0 0 18px 0;
  }

  /* -------- Section headings -------- */
  h1.section-title,
  h2 {
    color: ${theme.primary};
    font-size: 13pt;
    font-weight: 700;
    margin: 22px 0 10px 0;
  }
  h1.section-title { font-size: 14pt; }
  h3 {
    color: ${theme.primaryDark};
    font-size: 11pt;
    font-weight: 700;
    margin: 16px 0 6px 0;
  }

  p { margin: 6px 0; }

  /* -------- Tables (template-pack style) -------- */
  table.tp-table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0 14px 0;
    font-size: 9.5pt;
  }
  table.tp-table th {
    background: ${theme.tableHeader};
    color: #ffffff;
    padding: 7px 10px;
    text-align: left;
    font-weight: 700;
    border: 1px solid ${theme.primaryDark};
  }
  table.tp-table td {
    padding: 6px 10px;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    vertical-align: top;
  }
  table.tp-table tr:nth-child(even) td {
    background: ${theme.tableAltRow};
  }

  /* "Project Information"-style two-column info tables (first col shaded) */
  table.tp-table.info-table td:first-child {
    background: ${theme.primarySoft};
    font-weight: 700;
    width: 32%;
  }

  /* -------- Lists -------- */
  ul { margin: 6px 0 10px 18px; padding: 0; }
  ul li { margin: 2px 0; }

  strong { color: ${theme.primaryDark}; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

  /* -------- Footer strip (rendered per page via Puppeteer) -------- */
  .doc-footer-spacer { height: 40px; }
</style>
</head>
<body>
  <div class="banner">
    <div class="left">${bannerLeft}</div>
    <div class="right">${bannerRight}</div>
  </div>
  <div class="page">
    <div class="title">${safeTitle}</div>
    ${safeSubtl ? `<div class="subtitle">${safeSubtl}</div>` : ''}
    ${html}
    <div class="doc-footer-spacer"></div>
  </div>
</body>
</html>`;
}

function footerTemplate(theme) {
  // Puppeteer footer — 3-column layout matching the template pack footer:
  //   Confidential — JES BIM Operations · Template v1.0 · Page N
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:8px;width:100%;color:#475569;padding:0 40px;">
      <div style="border-top:1px solid ${theme.primary};padding-top:6px;display:flex;justify-content:space-between;">
        <span>${theme.footerLine}</span>
        <span>Template v1.0</span>
        <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    </div>`;
}

function filenameFor({ kind, reportLabel, title }) {
  const slug = (s) => String(s || 'Report').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Report';
  const prefix = kind === 'resourcing' ? 'JES_BIM_Resourcing' : 'JES_BIM';
  const label  = slug(reportLabel || title);
  const date   = new Date().toISOString().slice(0, 10);
  return `${prefix}_${label}_${date}.pdf`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const {
      reportContent,
      reportHtml,                // NEW — preformatted rich HTML (e.g. KPI report). Skips markdown conversion.
      title,
      subtitle,
      kind: kindOverride,
      reportLabel: labelOverride,
      reportType, // optional — used to infer kind + banner label
    } = req.body;

    if (!reportContent && !reportHtml) {
      return res.status(400).json({ error: 'Report content is required' });
    }

    // Resolve theme kind + banner label.
    const preset = TYPE_PRESETS[(reportType || '').toLowerCase()] || TYPE_PRESETS['status'];
    const kind        = (kindOverride === 'resourcing' || kindOverride === 'lump-sum')
                          ? kindOverride
                          : preset.kind;
    const reportLabel = labelOverride || preset.label;
    const theme       = THEMES[kind];

    // If caller provided rich HTML (e.g. the KPI pivot report), wrap it in a
    // minimal page shell so it has @page rules + base styling. Otherwise fall
    // back to converting markdown via renderHTML().
    const htmlContent = reportHtml
      ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 14mm; font-family: 'Helvetica Neue', Arial, sans-serif; color:#0f172a; }
        </style></head><body>${reportHtml}</body></html>`
      : renderHTML(reportContent, {
          title:    title    || `JES BIM — ${reportLabel}`,
          subtitle: subtitle || '',
          kind,
          reportLabel,
        });

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
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '22mm', left: '0' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate(theme),
      });

      await browser.close();
    } catch (puppeteerError) {
      // Fallback: return HTML for client-side PDF generation.
      console.warn('Puppeteer not available, returning HTML for client-side PDF:', puppeteerError.message);
      return res.status(200).json({
        success: true,
        fallback: true,
        html: htmlContent,
        kind,
        reportLabel,
        message: 'Server-side PDF not available. Use client-side generation.',
      });
    }

    const filename = filenameFor({ kind, reportLabel, title });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
