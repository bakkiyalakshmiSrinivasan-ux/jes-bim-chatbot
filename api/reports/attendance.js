// api/reports/attendance.js
// JES Resource Updates — Daily Attendance Report
// Fetches from publicly published Google Sheets — NO API KEY required.
//
// POST /api/reports/attendance
//   Auth: Bearer <JWT>
//   Returns: application/pdf

const path  = require('path');
const https = require('https');
const http  = require('http');
const jwt   = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

// ── Published Sheet URLs (no API key needed) ──────────────────────────────────
const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-v4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pubhtml/sheet?headers=false&gid=1531829939';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pubhtml/sheet?headers=false&gid=1097493991';

// ── Fonts ─────────────────────────────────────────────────────────────────────
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

// ── HTTP fetch with redirect follow ──────────────────────────────────────────
function fetchHtml(url, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JESBot/1.0)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(fetchHtml(next, depth + 1));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', ch => body += ch);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Parse HTML table into rows of string arrays ───────────────────────────────
function parseTable(html) {
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdM;
    while ((tdM = tdRe.exec(trM[1])) !== null) {
      cells.push(
        tdM[1].replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
              .trim()
      );
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  return rows;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayDDMMYYYY() {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}
function todayMonDD() {
  const d = new Date();
  return MONTHS[d.getMonth()] + '-' + String(d.getDate()).padStart(2,'0');
}

const ABSENT_RE   = /^(leave|week.?off|holiday|absent.*|day.?off)$/i;
const SKIP_RE     = /^(internal|0+\.?0*|)$/;
const TRAINING_RE = /^(T_|I_)/;

// ── Parse ARCH sheet ──────────────────────────────────────────────────────────
function parseArch(html) {
  const rows = parseTable(html);
  const today = todayDDMMYYYY();
  const dateRow = rows.find(r => r.some(c => /^\d{2}-\d{2}-\d{4}$/.test(c)));
  if (!dateRow) return [];
  const colIdx = dateRow.findIndex(c => c === today);
  return rows
    .filter(r => {
      const name = r[3], desig = r[4];
      if (!name || !desig || name.length < 2) return false;
      if (/^(mon|tue|wed|thu|fri|sat|sun)/i.test(desig)) return false;
      if (/^(designation|resources|on.?boarding|batch|location)$/i.test(name)) return false;
      return true;
    })
    .map(r => ({ name: r[3], designation: r[4], today: colIdx >= 0 ? (r[colIdx] || '').trim() : '', baseProject: null }));
}

// ── Parse MEP sheet ───────────────────────────────────────────────────────────
function parseMEP(html) {
  const rows = parseTable(html);
  const today = todayMonDD();
  const headerRow = rows.find(r => r.some(c => /^[A-Z][a-z]{2}-\d{2}$/.test(c)));
  if (!headerRow) return [];
  const colIdx = headerRow.findIndex(c => c.toLowerCase() === today.toLowerCase());
  return rows
    .filter(r => {
      const emp = r[2], desig = r[4];
      if (!emp || !desig || emp.length < 2) return false;
      if (/^(employees|designation|s\.?no|department|location|project)$/i.test(emp)) return false;
      if (/^(s\.?no|\d+)$/.test(emp)) return false;
      return true;
    })
    .map(r => ({ name: r[2], designation: r[4], today: colIdx >= 0 ? (r[colIdx] || '').trim() : '', baseProject: r[6] || null }));
}

// ── Aggregate resources into project rows ─────────────────────────────────────
function aggregate(resources) {
  const map = {};
  function entry(proj) {
    if (!map[proj]) map[proj] = { project: proj, srModeller: 0, bimModeller: 0, interns: 0, absent: 0, total: 0 };
    return map[proj];
  }
  function role(designation) {
    const d = designation.toLowerCase();
    if (/intern/i.test(d)) return 'intern';
    if (/senior|lead|coordinator|manager|head|principal|director/i.test(d)) return 'sr';
    return 'bim';
  }
  for (const r of resources) {
    const val = r.today;
    const isAbsent = ABSENT_RE.test(val);
    const isSkip   = !isAbsent && SKIP_RE.test(val);
    if (isSkip) continue;
    if (isAbsent) {
      if (r.baseProject && !SKIP_RE.test(r.baseProject.trim())) {
        const proj = r.baseProject.replace(TRAINING_RE, '').trim();
        const e = entry(proj);
        e.absent++;
        e.total++;
      }
      continue;
    }
    const isTraining = TRAINING_RE.test(val);
    const proj = val.replace(TRAINING_RE, '').trim();
    const e = entry(proj);
    if (isTraining) {
      e.interns++;
    } else {
      const r2 = role(r.designation);
      if (r2 === 'intern') e.interns++;
      else if (r2 === 'sr') e.srModeller++;
      else e.bimModeller++;
    }
    e.total++;
  }
  return Object.values(map).sort((a, b) => a.project.localeCompare(b.project));
}

// ── Build pdfmake document ───────────────────────────────────────────────────
function buildDocDef(archRows, mepRows, dateStr) {
  const NAVY = '#1A2F5A', BLUE = '#1F4FCB', LBLUE = '#D6E4FF';
  const LGREY = '#F5F7FC', WHITE = '#FFFFFF', DARK = '#111827';
  const MEPBLUE = '#0B4F6C';
  const COLS = ['*', 70, 55, 60, 50, 45, 50, 55];

  function sectionHeader(label, color) {
    return { margin: [0,10,0,0], table: { widths: ['*'], body: [[
      { text: label, bold: true, fontSize: 10, color: WHITE, fillColor: color, margin: [8,5,8,5] }
    ]]}, layout: 'noBorders' };
  }

  function colHeaders() {
    return ['Project Name','BIM Count','Sr. Modeller','BIM Modeller','Interns','Absent','No. of Res.','Active Res.'].map((h, i) => ({
      text: h, bold: true, fontSize: 8, color: WHITE, fillColor: BLUE,
      margin: [4,5,4,5], alignment: i === 0 ? 'left' : 'center',
    }));
  }

  function dataRow(row, idx) {
    const active = row.total - row.absent;
    const fill = idx % 2 === 1 ? LGREY : undefined;
    const c = (val, align) => ({ text: String(val != null ? val : 0), fontSize: 8, margin: [4,4,4,4], alignment: align || 'center', fillColor: fill, color: DARK });
    return [c(row.project,'left'), c(row.srModeller+row.bimModeller), c(row.srModeller), c(row.bimModeller), c(row.interns), c(row.absent), c(row.total), c(active>0?active:0)];
  }

  function totalRow(rows) {
    const t = rows.reduce((acc,r) => ({ sr: acc.sr+r.srModeller, bim: acc.bim+r.bimModeller, intern: acc.intern+r.interns, absent: acc.absent+r.absent, total: acc.total+r.total }), {sr:0,bim:0,intern:0,absent:0,total:0});
    const active = t.total - t.absent;
    const bc = v => ({ text: String(v), bold: true, fontSize: 8.5, margin: [4,5,4,5], alignment: 'center', fillColor: LBLUE, color: NAVY });
    return [{ text:'TOTAL', bold:true, fontSize:8.5, margin:[4,5,4,5], fillColor:LBLUE, color:NAVY }, bc(t.sr+t.bim), bc(t.sr), bc(t.bim), bc(t.intern), bc(t.absent), bc(t.total), bc(active>0?active:0)];
  }

  function section(rows, label, color) {
    const data = rows.length ? rows : [{ project:'No data today', srModeller:0, bimModeller:0, interns:0, absent:0, total:0 }];
    const body = [colHeaders(), ...data.map(dataRow), totalRow(data)];
    return [sectionHeader(label, color), { margin:[0,0,0,8], table:{ headerRows:1, widths:COLS, body }, layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#CBD5E1', vLineColor:()=>'#CBD5E1', paddingTop:()=>0, paddingBottom:()=>0, paddingLeft:()=>0, paddingRight:()=>0 }}];
  }

  function footerStat(label, rows) {
    const total=rows.reduce((s,r)=>s+r.total,0), absent=rows.reduce((s,r)=>s+r.absent,0), active=total-absent;
    const absPct=total?((absent/total)*100).toFixed(1):'0.0', utilPct=total?((active/total)*100).toFixed(1):'0.0';
    return { text: label+' — Total: '+total+' | Active: '+active+' | Absent: '+absent+' | Absence: '+absPct+'% | Utilization: '+utilPct+'%', fontSize:8, color:'#555', margin:[0,2,0,0] };
  }

  return {
    pageSize:'A4', pageOrientation:'landscape', pageMargins:[36,80,36,50],
    header: () => ({ stack:[
      { canvas:[{ type:'rect', x:0, y:0, w:841.89, h:48, color:NAVY }] },
      { columns:[
        { width:'*', text:'JES RESOURCE UPDATES', color:WHITE, bold:true, fontSize:14, margin:[36,-34,0,0] },
        { width:'auto', text:'Daily Resource Allocation & Attendance | '+dateStr, color:'#AAC4FF', fontSize:8.5, alignment:'right', margin:[0,-30,36,0] }
      ]}
    ]}),
    footer: (pg,pc) => ({ margin:[36,10,36,0], columns:[
      { text:'Confidential — JES BIM Operations', fontSize:7.5, color:'#888', width:'*' },
      { text:'JES BIM Operations AI  •  Auto-generated', fontSize:7.5, color:'#888', alignment:'center', width:'*' },
      { text:'Page '+pg+' of '+pc, fontSize:7.5, color:'#888', alignment:'right', width:'*' }
    ]}),
    defaultStyle: { font:'DejaVuSans', fontSize:9, color:DARK },
    content:[
      ...section(archRows,'ARCHITECTURE (ARCH)',NAVY),
      ...section(mepRows,'MEP DIVISION',MEPBLUE),
      { margin:[0,10,0,0], stack:[
        footerStat('ARCH', archRows.length?archRows:[{total:0,absent:0}]),
        footerStat('MEP',  mepRows.length?mepRows:[{total:0,absent:0}])
      ]}
    ]
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [archHtml, mepHtml] = await Promise.all([fetchHtml(ARCH_URL), fetchHtml(MEP_URL)]);
    const archRows = aggregate(parseArch(archHtml));
    const mepRows  = aggregate(parseMEP(mepHtml));
    const today   = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const docDef  = buildDocDef(archRows, mepRows, dateStr);
    const pdfDoc = printer.createPdfKitDocument(docDef);
    const chunks = [];
    pdfDoc.on('data', ch => chunks.push(ch));
    pdfDoc.on('end', () => {
      const buf = Buffer.concat(chunks);
      const filename = 'JES_Resource_Updates_' + today.toISOString().slice(0,10) + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-Length', buf.length);
      res.status(200).send(buf);
    });
    pdfDoc.on('error', err => { if (!res.headersSent) res.status(500).json({ error: 'PDF: '+err.message }); });
    pdfDoc.end();
  } catch(err) {
    console.error('[attendance]', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};
