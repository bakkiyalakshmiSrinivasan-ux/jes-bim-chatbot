// api/reports/attendance.js
// JES Resource Updates â Daily Attendance Report
// Fetches from publicly published Google Sheets â NO API KEY required.
//
// POST /api/reports/attendance
//   Auth: Bearer <JWT>
//   Returns: application/pdf

const path  = require('path');
const https = require('https');
const http  = require('http');
const jwt   = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

// ââ Published Sheet URLs ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-v4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pubhtml/sheet?headers=false&gid=1531829939';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pubhtml/sheet?headers=false&gid=1097493991';

// ââ Fonts âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// ââ HTTP fetch with redirect follow ââââââââââââââââââââââââââââââââââââââââââ
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

// ââ Parse HTML table into rows of string arrays âââââââââââââââââââââââââââââââ
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

// ââ Date helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayDDMMYYYY() {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}
function todayMonDD() {
  const d = new Date();
  return MONTH_NAMES[d.getMonth()] + '-' + String(d.getDate()).padStart(2,'0');
}

// ââ Absence / skip patterns âââââââââââââââââââââââââââââââââââââââââââââââââââ
const ABSENT_RE   = /^(leave|week.?off|holiday|absent.*|day.?off|weekoff)$/i;
const SKIP_RE     = /^(internal|0+\.?0*|co.?pilot)$/i;
const TRAINING_RE = /^(T_|I_)/i;

// ââ Project mapping: code (lowercase) â { client, name, type } âââââââââââââââ
// type: 'Lumpsum' | 'Resourcing'
const PROJ_MAP = {
  // ARCH â Lumpsum
  'topgolf':                { client: 'M4 Contracting',         name: 'Top Golf',                          type: 'Lumpsum'    },
  'top golf':               { client: 'M4 Contracting',         name: 'Top Golf',                          type: 'Lumpsum'    },
  'albadia z6':             { client: 'AFE Contracting',        name: 'Albadia Phase 6',                   type: 'Lumpsum'    },
  'albadia':                { client: 'AFE Contracting',        name: 'Albadia Phase 6',                   type: 'Lumpsum'    },
  'albadia phase 6':        { client: 'AFE Contracting',        name: 'Albadia Phase 6',                   type: 'Lumpsum'    },
  'orla towers':            { client: 'ATS',                    name: 'Orla + OT Sky Palace',              type: 'Lumpsum'    },
  'ot sky palace':          { client: 'ATS',                    name: 'Orla + OT Sky Palace',              type: 'Lumpsum'    },
  'orla+ot':                { client: 'ATS',                    name: 'Orla + OT Sky Palace',              type: 'Lumpsum'    },
  'abaad wood':             { client: 'Abaad Wood Industries',  name: 'Saadiyat Island, The Grove Ph.02',  type: 'Lumpsum'    },
  'dsa':                    { client: 'DSA Architects Intl.',   name: 'Water Park HOT KSA',                type: 'Lumpsum'    },
  // ARCH â Resourcing
  'h2r':                    { client: 'H2R',                    name: 'Maison Margiela Residence',         type: 'Resourcing' },
  'dar':                    { client: 'DAR',                    name: 'Al Maktoum Intl. Airport â UAE', type: 'Resourcing' },
  // MEP â Lumpsum
  'top golf (asbuilt )':    { client: 'M4 Contracting',         name: 'Top Golf',                          type: 'Lumpsum'    },
  'top golf (asbuilt)':     { client: 'M4 Contracting',         name: 'Top Golf',                          type: 'Lumpsum'    },
  'golf hillside':          { client: 'M4 Contracting',         name: 'Golf Hillside',                     type: 'Lumpsum'    },
  'al-badia phase 6':       { client: 'AFE Contracting',        name: 'Al-Badia Phase 6',                  type: 'Lumpsum'    },
  'mng':                    { client: 'MNG',                    name: 'Blue Line Metro',                   type: 'Lumpsum'    },
  'omnitech':               { client: 'Omnitech',               name: 'Omnitech',                          type: 'Lumpsum'    },
  // MEP â Resourcing
  'alemco':                 { client: 'ALEMCO',                 name: 'Wynn Al Marjan Island',             type: 'Resourcing' },
  'wynn':                   { client: 'ALEMCO',                 name: 'Wynn Al Marjan Island',             type: 'Resourcing' },
  'data center':            { client: 'ALEMCO',                 name: 'Data Centre',                       type: 'Resourcing' },
  'data centre':            { client: 'ALEMCO',                 name: 'Data Centre',                       type: 'Resourcing' },
  'data center (new)':      { client: 'ALEMCO',                 name: 'Data Centre (New)',                 type: 'Resourcing' },
  'data centre (new)':      { client: 'ALEMCO',                 name: 'Data Centre (New)',                 type: 'Resourcing' },
  'admin bldg':             { client: 'ALEMCO',                 name: 'Admin Building',                    type: 'Resourcing' },
  'admin building':         { client: 'ALEMCO',                 name: 'Admin Building',                    type: 'Resourcing' },
  'alemco co2 gas':         { client: 'ALEMCO',                 name: 'CO2 Gas (ALEMCO)',                  type: 'Resourcing' },
};

function lookupProj(rawCode) {
  if (!rawCode) return null;
  const key = rawCode.replace(TRAINING_RE, '').trim().toLowerCase();
  if (PROJ_MAP[key]) return PROJ_MAP[key];
  // Partial match fallback
  for (const [k, v] of Object.entries(PROJ_MAP)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

// ââ Role from designation ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Returns: 'coord' | 'sn' | 'bim' | 'intern'
function getRole(desig) {
  const d = (desig || '').toLowerCase();
  if (/coord|lead|manager/i.test(d)) return 'coord';
  if (/senior/i.test(d))            return 'sn';
  if (/junior|intern/i.test(d))     return 'intern';
  return 'bim';
}

// ââ Find last known project from previous days âââââââââââââââââââââââââââââââââ
function findBaseFromPrev(prevVals) {
  for (const v of prevVals) {
    if (!v || ABSENT_RE.test(v) || SKIP_RE.test(v) || /^internal$/i.test(v)) continue;
    const code = v.replace(TRAINING_RE, '').trim();
    if (code && lookupProj(code)) return code;
  }
  return null;
}

// ââ Parse ARCH sheet ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Columns: [0]=rowNum [1]=group [2]=name [3]=designation [8+]=DD-MM-YYYY dates
function parseArch(html) {
  const rows = parseTable(html);
  if (!rows.length) return [];

  // Row index 1 has DD-MM-YYYY date headers
  const headerRow = rows[1] || [];
  const today = todayDDMMYYYY();

  // Build index: date string â col index
  const dateIdx = {};
  headerRow.forEach((c, i) => { if (/^\d{2}-\d{2}-\d{4}$/.test(c)) dateIdx[c] = i; });

  const todayCol = dateIdx[today] != null ? dateIdx[today] : -1;

  // Previous date columns sorted newestâoldest
  const prevCols = Object.entries(dateIdx)
    .filter(([d]) => d < today)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, i]) => i);

  const people = [];
  for (const r of rows) {
    // Only numbered rows (row numbers 1, 2, 3...)
    if (!/^\d+$/.test(r[0])) continue;
    const name  = 
