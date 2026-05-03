// api/reports/attendance.js
// JES Resource Updates — Daily Attendance Report
// Fetches live data from Arch + MEP Google Sheets and generates a structured PDF
// using the pdfmake master template pack.
//
// POST /api/reports/attendance
//   Auth: Bearer <JWT>
//   Returns: application/pdf

const path   = require('path');
const fs     = require('fs');
const jwt    = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

const { fetchAllResourcesLive } = require('../data/_googleSheets');

// ── Fonts (same as master.js) ─────────────────────────────────────────────────
const FONT_DIR = path.join(__dirname, '_master', 'fonts');
const printer  = new PdfPrinter({
  DejaVuSans: {
    normal:      path.join(FONT_DIR, 'DejaVuSans.ttf'),
    bold:        path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
    italics:     path.join(FONT_DIR, 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(FONT_DIR, 'DejaVuSans-BoldOblique.ttf'),
  },
});

function verifyToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── Aggregate resources by project ───────────────────────────────────────────
function aggregateByProject(resources) {
  const map = {};
  for (const r of resources) {
    const proj = (r.current_project || '').trim();
    if (!proj || proj === 'Unassigned') continue;

    const isLeave  = /^leave$/i.test(proj);
    const isIntern = /^I_/.test(proj) || /intern/i.test(r.designation);
    const cleanProj = proj.replace(/^I_/, '').trim();

    if (!map[cleanProj]) {
      map[cleanProj] = { project: cleanProj, srModeller: 0, bimModeller: 0, interns: 0, absent: 0, total: 0 };
    }

    const d = (r.designation || '').toLowerCase();
    if (isLeave) {
      map[cleanProj].absent++;
    } else if (isIntern || d.includes('intern')) {
      map[cleanProj].interns++;
    } else if (d.includes('senior') || d.includes('coordinator') || d.includes('lead') || d.includes('manager')) {
      map[cleanProj].srModeller++;
    } else {
      map[cleanProj].bimModeller++;
    }
    map[cleanProj].total++;
  }
  return Object.values(map).sort((a, b) => a.project.localeCompare(b.project));
}

// ── Cross-reference with projects_data.json for client + billing model ────────
function enrichWithProjectData(projRows) {
  let projectsData = [];
  try {
    const p = path.join(process.cwd(), 'public', 'projects_data.json');
    projectsData = JSON.parse(fs.readFileSync(p, 'utf8')).projects || [];
  } catch { /* use raw names if file missing */ }

  return projRows.map(row => {
    const match = projectsData.find(p =>
      row.project.toLowerCase().includes((p.name || '').toLowerCase().slice(0, 6)) ||
      (p.name || '').toLowerCase().includes(row.project.toLowerCase().slice(0, 6))
    );
    return {
      ...row,
      client:       (match && match.client) || '—',
      billingModel: (match && match.billing_model) || 'Lump Sum',
    };
  });
}

// ── Build pdfmake doc definition ──────────────────────────────────────────────
function buildDocDef(archRows, mepRows, dateStr) {
  const NAVY   = '#1A2F5A';
  const BLUE   = '#1F4FCB';
  const LBLUE  = '#D6E4FF';
  const GREEN  = '#1B5E20';
  const LGREY  = '#F5F7FC';
  const WHITE  = '#FFFFFF';
  const DARK   = '#111827';

  const COLS = ['*', 70, 55, 60, 50, 45, 50, 55];

  function sectionHeader(label, color) {
    return {
      margin: [0, 10, 0, 0],
      table: { widths: ['*'], body: [[
        { text: '  ' + label, bold: true, fontSize: 10, color: WHITE,
          fillColor: color, margin: [8, 5, 8, 5] }
      ]]},
      layout: 'noBorders',
    };
  }

  function colHeaders() {
    const hdrs = ['Project Name', 'BIM Count', 'Sr. Modeller', 'BIM Modeller', 'Interns', 'Absent', 'No. of Res.', 'Active Res.'];
    return hdrs.map((h, i) => ({
      text: h, bold: true, fontSize: 8, color: WHITE, fillColor: BLUE,
      margin: [4, 5, 4, 5], alignment: i === 0 ? 'left' : 'center',
    }));
  }

  function dataRow(row, idx) {
    const active = row.total - row.absent;
    const fill   = idx % 2 === 1 ? LGREY : undefined;
    function cell(val, align) {
      return { text: String(val != null ? val : '—'), fontSize: 8, margin: [4, 4, 4, 4],
               alignment: align || 'center', fillColor: fill, color: DARK };
    }
    return [
      cell(row.project, 'left'),
      cell(row.srModeller + row.bimModeller),
      cell(row.srModeller),
      cell(row.bimModeller),
      cell(row.interns),
      cell(row.absent),
      cell(row.total),
      cell(active > 0 ? active : 0),
    ];
  }

  function totalRow(rows) {
    const t = { project: 'TOTAL', srModeller: 0, bimModeller: 0, interns: 0, absent: 0, total: 0 };
    for (const r of rows) {
      t.srModeller  += r.srModeller;
      t.bimModeller += r.bimModeller;
      t.interns     += r.interns;
      t.absent      += r.absent;
      t.total       += r.total;
    }
    const active = t.total - t.absent;
    function bcell(val) {
      return { text: String(val), bold: true, fontSize: 8.5, margin: [4, 5, 4, 5],
               alignment: 'center', fillColor: LBLUE, color: NAVY };
    }
    return [
      { text: 'TOTAL', bold: true, fontSize: 8.5, margin: [4, 5, 4, 5], fillColor: LBLUE, color: NAVY },
      bcell(t.srModeller + t.bimModeller),
      bcell(t.srModeller),
      bcell(t.bimModeller),
      bcell(t.interns),
      bcell(t.absent),
      bcell(t.total),
      bcell(active > 0 ? active : 0),
    ];
  }

  function buildSection(rows, label, color) {
    const body = [colHeaders(), ...rows.map(dataRow), totalRow(rows)];
    return [
      sectionHeader(label, color),
      {
        margin: [0, 0, 0, 8],
        table: { headerRows: 1, widths: COLS, body },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1', vLineColor: () => '#CBD5E1',
          paddingTop: () => 0, paddingBottom: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
        },
      },
    ];
  }

  function footerStats(label, rows) {
    const total  = rows.reduce((s, r) => s + r.total, 0);
    const absent = rows.reduce((s, r) => s + r.absent, 0);
    const active = total - absent;
    const absPct = total ? ((absent / total) * 100).toFixed(1) : '0.0';
    const utilPct = total ? ((active / total) * 100).toFixed(1) : '0.0';
    return { text: label + ' — Total: ' + total + ' | Active: ' + active + ' | Absent: ' + absent + ' | Absence: ' + absPct + '% | Utilization: ' + utilPct + '%',
             fontSize: 8, color: '#555', margin: [0, 2, 0, 0] };
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 80, 36, 50],
    header: () => ({
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 841.89, h: 48, color: NAVY }] },
        {
          columns: [
            { width: '*',    text: 'JES RESOURCE UPDATES',         color: WHITE, bold: true, fontSize: 14, margin: [36, -34, 0, 0] },
            { width: 'auto', text: 'Daily Resource Allocation & Attendance Report | ' + dateStr,
              color: '#AAC4FF', fontSize: 8.5, alignment: 'right', margin: [0, -30, 36, 0] },
          ],
        },
      ],
    }),
    footer: (pg, pc) => ({
      margin: [36, 10, 36, 0],
      columns: [
        { text: 'Confidential — JES BIM Operations', fontSize: 7.5, color: '#888', width: '*' },
        { text: 'JES BIM Operations AI  •  Auto-generated', fontSize: 7.5, color: '#888', alignment: 'center', width: '*' },
        { text: 'Page ' + pg + ' of ' + pc, fontSize: 7.5, color: '#888', alignment: 'right', width: '*' },
      ],
    }),
    defaultStyle: { font: 'DejaVuSans', fontSize: 9, color: DARK },
    content: [
      ...buildSection(archRows.length ? archRows : [{ project: 'No data', srModeller: 0, bimModeller: 0, interns: 0, absent: 0, total: 0 }],
                      'ARCHITECTURE (ARCH)', NAVY),
      ...buildSection(mepRows.length  ? mepRows  : [{ project: 'No data', srModeller: 0, bimModeller: 0, interns: 0, absent: 0, total: 0 }],
                      'MEP DIVISION', '#0B4F6C'),
      { margin: [0, 10, 0, 0], stack: [
        footerStats('ARCH', archRows),
        footerStats('MEP',  mepRows),
      ]},
    ],
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { arch, mep } = await fetchAllResourcesLive();

    const archRows = enrichWithProjectData(aggregateByProject(arch));
    const mepRows  = enrichWithProjectData(aggregateByProject(mep));

    const today   = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });
    const docDef  = buildDocDef(archRows, mepRows, dateStr);

    const pdfDoc = printer.createPdfKitDocument(docDef);
    const chunks = [];
    pdfDoc.on('data', ch => chunks.push(ch));
    pdfDoc.on('end', () => {
      const buf      = Buffer.concat(chunks);
      const filename = 'JES_Resource_Updates_' + today.toISOString().slice(0, 10) + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-Length', buf.length);
      res.status(200).send(buf);
    });
    pdfDoc.on('error', err => {
      if (!res.headersSent) res.status(500).json({ error: 'PDF error: ' + err.message });
    });
    pdfDoc.end();
  } catch (err) {
    console.error('Attendance report error:', err);
    res.status(500).json({ error: err.message });
  }
};
