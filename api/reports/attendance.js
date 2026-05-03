// api/reports/attendance.js
// JES Resource Updates - Daily Attendance Report
// POST /api/reports/attendance  Auth: Bearer <JWT>  Returns: application/pdf

const path = require('path');
const https = require('https');
const http  = require('http');
const jwt   = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-V4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pubhtml/sheet?headers=false&gid=1531829939';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pubhtml/sheet?headers=false&gid=1097493991';

const FONT_DIR = path.join(__dirname, '_master', 'fonts');
const printer  = new PdfPrinter({ DejaVuSans: {
  normal:      path.join(FONT_DIR, 'DejaVuSans.ttf'),
  bold:        path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
  italics:     path.join(FONT_DIR, 'DejaVuSans-Oblique.ttf'),
  bolditalics: path.join(FONT_DIR, 'DejaVuSans-BoldOblique.ttf'),
}});

function verifyToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

function fetchHtml(url, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JESBot/1.0)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location
          : new URL(res.headers.location, url).href;
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

function parseTable(html) {
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdM;
    while ((tdM = tdRe.exec(trM[1])) !== null) {
      cells.push(tdM[1].replace(/<[^>]+>/g,'')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
        .replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim());
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  return rows;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function todayDDMMYYYY() {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear();
}
function todayMonDD() {
  const d = new Date();
  return MONTHS[d.getMonth()]+'-'+String(d.getDate()).padStart(2,'0');
}
function todayLabel() {
  const d = new Date();
  return d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear()+' - '+DAYS[d.getDay()];
}

const ABSENT_RE   = /^(leave|week.?off|holiday|absent.*|day.?off|weekoff)$/i;
const SKIP_RE     = /^(internal|0+\.?0*|co.?pilot)$/i;
const TRAINING_RE = /^(T_|I_)/i;

const PROJ_MAP = {
  'topgolf':            { client:'M4 Contracting',        name:'Top Golf',                         type:'Lumpsum'    },
  'top golf':           { client:'M4 Contracting',        name:'Top Golf',                         type:'Lumpsum'    },
  'albadia z6':         { client:'AFE Contracting',       name:'Albadia Phase 6',                  type:'Lumpsum'    },
  'albadia':            { client:'AFE Contracting',       name:'Albadia Phase 6',                  type:'Lumpsum'    },
  'albadia phase 6':    { client:'AFE Contracting',       name:'Albadia Phase 6',                  type:'Lumpsum'    },
  'orla towers':        { client:'ATS',                   name:'Orla + OT Sky Palace',             type:'Lumpsum'    },
  'ot sky palace':      { client:'ATS',                   name:'Orla + OT Sky Palace',             type:'Lumpsum'    },
  'orla+ot':            { client:'ATS',                   name:'Orla + OT Sky Palace',             type:'Lumpsum'    },
  'abaad wood':         { client:'Abaad Wood Industries', name:'Saadiyat Island, The Grove Ph.02', type:'Lumpsum'    },
  'dsa':                { client:'DSA Architects Intl.',  name:'Water Park HOT KSA',               type:'Lumpsum'    },
  'h2r':                { client:'H2R',                   name:'Maison Margiela Residence',        type:'Resourcing' },
  'dar':                { client:'DAR',                   name:'Al Maktoum Intl. Airport - UAE',   type:'Resourcing' },
  'top golf (asbuilt )':{ client:'M4 Contracting',        name:'Top Golf',                         type:'Lumpsum'    },
  'top golf (asbuilt)': { client:'M4 Contracting',        name:'Top Golf',                         type:'Lumpsum'    },
  'golf hillside':      { client:'M4 Contracting',        name:'Golf Hillside',                    type:'Lumpsum'    },
  'al-badia phase 6':   { client:'AFE Contracting',       name:'Al-Badia Phase 6',                 type:'Lumpsum'    },
  'mng':                { client:'MNG',                   name:'Blue Line Metro',                  type:'Lumpsum'    },
  'omnitech':           { client:'Omnitech',              name:'Omnitech',                         type:'Lumpsum'    },
  'alemco':             { client:'ALEMCO',                name:'Wynn Al Marjan Island',            type:'Resourcing' },
  'wynn':               { client:'ALEMCO',                name:'Wynn Al Marjan Island',            type:'Resourcing' },
  'data center':        { client:'ALEMCO',                name:'Data Centre',                      type:'Resourcing' },
  'data centre':        { client:'ALEMCO',                name:'Data Centre',                      type:'Resourcing' },
  'data center (new)':  { client:'ALEMCO',                name:'Data Centre (New)',                type:'Resourcing' },
  'data centre (new)':  { client:'ALEMCO',                name:'Data Centre (New)',                type:'Resourcing' },
  'admin bldg':         { client:'ALEMCO',                name:'Admin Building',                   type:'Resourcing' },
  'admin building':     { client:'ALEMCO',                name:'Admin Building',                   type:'Resourcing' },
  'alemco co2 gas':     { client:'ALEMCO',                name:'CO2 Gas (ALEMCO)',                 type:'Resourcing' },
};

function lookupProj(raw) {
  if (!raw) return null;
  const key = raw.replace(TRAINING_RE,'').trim().toLowerCase();
  if (PROJ_MAP[key]) return PROJ_MAP[key];
  for (const [k,v] of Object.entries(PROJ_MAP)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

function getRole(desig) {
  const d = (desig||'').toLowerCase();
  if (/coord|lead|manager/i.test(d)) return 'coord';
  if (/senior/i.test(d))             return 'sn';
  if (/junior|intern/i.test(d))      return 'intern';
  return 'bim';
}

function findBase(prevVals) {
  for (const v of prevVals) {
    if (!v || ABSENT_RE.test(v) || SKIP_RE.test(v)) continue;
    const code = v.replace(TRAINING_RE,'').trim();
    if (code && lookupProj(code)) return code;
  }
  return null;
}

function parseArch(html) {
  const rows = parseTable(html);
  if (!rows.length) return [];
  const hdr = rows[1] || [];
  const today = todayDDMMYYYY();
  const dateIdx = {};
  hdr.forEach((c,i) => { if (/^\d{2}-\d{2}-\d{4}$/.test(c)) dateIdx[c] = i; });
  const tCol = dateIdx[today] != null ? dateIdx[today] : -1;
  const pCols = Object.entries(dateIdx).filter(([d]) => d < today)
    .sort(([a],[b]) => b.localeCompare(a)).map(([,i]) => i);
  const people = [];
  for (const r of rows) {
    if (!/^\d+$/.test(r[0])) continue;
    const name  = (r[2]||'').trim();
    const desig = (r[3]||'').trim();
    if (!name||name.length<2||!desig||desig.length<2) continue;
    if (/projects?\s*manager/i.test(desig)) continue;
    const todayVal = tCol>=0 ? (r[tCol]||'').trim() : '';
    const prevVals = pCols.map(c => (r[c]||'').trim()).filter(Boolean);
    people.push({ name, designation:desig, todayVal, prevVals, baseProject:null });
  }
  return people;
}

function parseMEP(html) {
  const rows = parseTable(html);
  if (!rows.length) return [];
  const hdr = rows[0] || [];
  const today = todayMonDD();
  const tCol = hdr.findIndex(c => c.toLowerCase()===today.toLowerCase());
  const pCols = [];
  for (let i=0; i<hdr.length; i++) {
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(hdr[i]) && i<tCol) pCols.unshift(i);
  }
  const people = [];
  for (const r of rows) {
    if (!/^\d+$/.test(r[0])) continue;
    const name  = (r[1]||'').trim();
    const desig = (r[4]||'').trim();
    const baseP = (r[6]||'').trim();
    if (!name||name.length<2||!desig||desig.length<2) continue;
    if (/projects?\s*manager/i.test(desig)) continue;
    const todayVal = tCol>=0 ? (r[tCol]||'').trim() : '';
    const prevVals = pCols.map(c => (r[c]||'').trim()).filter(Boolean);
    people.push({ name, designation:desig, todayVal, prevVals, baseProject:baseP });
  }
  return people;
}

function aggregate(arch, mep) {
  const map = {};
  function ensure(client,name,type) {
    const k = client+'|||'+name+'|||'+type;
    if (!map[k]) map[k] = { client,name,type,
      coord:{total:0,absent:0}, sn:{total:0,absent:0},
      bim:{total:0,absent:0},   intern:{total:0,absent:0} };
    return map[k];
  }
  function proc(p) {
    const absent = ABSENT_RE.test(p.todayVal);
    const skip   = SKIP_RE.test(p.todayVal)||TRAINING_RE.test(p.todayVal);
    if (!absent && skip) return;
    if (!absent && !p.todayVal) return;
    var pi;
    if (absent) {
      const code = (p.baseProject&&p.baseProject.length>0) ? p.baseProject : findBase(p.prevVals);
      if (!code) return;
      pi = lookupProj)code);
    } else { pi = lookupProj(p.todayVal); }
    if (!pi) return;
    const role = getRole(p.designation);
    const e = ensure(pi.client,pi.name,pi.type);
    e[role].total++;
    if (absent) e[role].absent++;
  }
  for (const p of arch) proc(p);
  for (const p of mep)  proc(p);
  return Object.values(map);
}

function buildPdf(projects) {
  const AMBER='#FFC000', BLUE='#2E75B6', WHITE='#FFFFFF', RED='#FF0000',
        HDR='#1F3864', LIGHT='#D9E1F2';
  const widths = [88,120,40,42,42,36,36,44,44];

  function roleCell(r,fill) {
    if (r.total===0) return {text:'0',alignment:'center',fontSize:8,fillColor:fill};
    if (r.absent===0) return {text:String(r.total),alignment:'center',fontSize:8,fillColor:fill};
    return { stack:[{ columns:[
      {text:String(r.total),fontSize:8,width:'auto'},
      {text:'(-'+r.absent+')',fontSize:8,color:RED,width:'auto'}
    ], columnGap:1 }], alignment:'center', fillColor:fill };
  }

  const hdrRow = [
    {text:'Client Name', style:'th'}, {text:'Project Name',style:'th'},
    {text:'BIM\nCoord',  style:'th'}, {text:'Sn.\nModeler', style:'th'},
    {text:'BIM\nModeler',style:'th'}, {text:'Interns',       style:'th'},
    {text:'Absent',      style:'th'}, {text:'No. of\nRes.', style:'th'},
    {text:'Active\nRes.',style:'th'},
  ];

  const ls = projects.filter(p=>p.type==='Lumpsum').sort((a,b)=>a.name.localeCompare(b.name));
  const rs = projects.filter(p=>p.type==='Resourcing').sort((a,b)=>a.name.localeCompare(b.name));

  function subHdr(label,color) {
    return [{text:label,colSpan:9,bold:true,fontSize:9,fillColor:color,color:WHITE,
      alignment:'center',margin:[0,3,0,3]},{},{},{},{},{},{},{},{}];
  }

  function projRow(p,i) {
    const fill = i%2===0 ? LIGHT : WHITE;
    const tot = p.coord.total+p.sn.total+p.bim.total+p.intern.total;
    const abs = p.coord.absent+p.sn.absent+p.bim.absent+p.intern.absent;
    return [
      {text:p.client,fontSize:8,fillColor:fill},
      {text:p.name,  fontSize:8,fillColor:fill},
      roleCell(p.coord,fill),  roleCell(p.sn,fill),
      roleCell(p.bim,fill),    roleCell(p.intern,fill),
      {text:abs>0?String(abs):'0',fontSize:8,alignment:'center',
        color:abs>0?RED:'#000000',bold:abs>0,fillColor:fill},
      {text:String(tot),       fontSize:8,alignment:'center',fillColor:fill},
      {text:String(tot-abs),   fontSize:8,alignment:'center',fillColor:fill},
    ];
  }

  const body = [hdrRow];
  if (ls.length) { body.push(subHdr('Lumpsum Projects',AMBER));    ls.forEach((p,i)=>body.push(projRow(p,i))); }
  if (rs.length) { body.push(subHdr('Resource Projects',BLUE));    rs.forEach((p,i)=>body.push(projRow(p,i))); }

  const all = [...ls,...rs];
  const gT = all.reduce((s,p)=>s+p.coord.total+p.sn.total+p.bim.total+p.intern.total,0);
  const gA = all.reduce((s,p)=>s+p.coord.absent+p.sn.absent+p.bim.absent+p.intern.absent,0);
  const gV = gT-gA;
  const absPct = gT>0 ? Math.round(gA/gT*100) : 0;
  const sum = 'Total: '+gT+'   |   Active: '+gV+'   |   Absent: '+gA+
    '   |   Absence: '+absPct+'%   |   Attendance: '+(100-absPct)+'%';

  return {
    pageSize:'A4', pageOrientation:'portrait', pageMargins:[30,40,30,50],
    defaultStyle:{font:'DejaVuSans',fontSize:9},
    styles:{
      title:{fontSize:20,bold:true,alignment:'center',color:HDR},
      subtitle:{fontSize:10,alignment:'center',color:'#444444',margin:[0,2,0,8]},
      th:{bold:true,fontSize:8,color:WHITE,fillColor:HDR,alignment:'center',margin:[0,3,0,3]},
    },
    content:[
      {text:'JES RESOURCE UPDATES',style:'title',margin:[0,0,0,4]},
      {text:todayLabel(),style:'subtitle'},
      {table:{headerRows:1,widths,body},layout:{
        hLineWidth:()=>0.5, vLineWidth:()=>0.5,
        hLineColor:()=>'#AAAAAA', vLineColor:()=>'#AAAAAA',
        paddingLeft:()=>3, paddingRight:()=>3, paddingTop:()=>2, paddingBottom:()=>2,
      }},
      {text:sum,fontSize:9,bold:true,alignment:'center',margin:[0,8,0,0]},
    ],
    footer:()=>({columns:[
      {text:'JES BIM Operations',alignment:'left', fontSize:7,color:'#777777',margin:[30,0,0,0]},
      {text:todayLabel(),         alignment:'right',fontSize:7,color:'#777777',margin:[0,0,30,0]},
    ]}),
  };
}

module.exports = async (req,res) => {
  if (req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if (!verifyToken(req))   return res.status(401).json({error:'Unauthorized'});
  try {
    const [aH,mH] = await Promise.all([fetchHtml(ARCH_URL),fetchHtml(MEP_URL)]);
    const projects = aggregate(parseArch(aH), parseMEP(mH));
    if (!projects.length) return res.status(200).json({message:'No data available for today'});
    const doc = printer.createPdfKitDocument(buildPdf(projects));
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename="JES_Resource_Updates_'+todayDDMMYYYY()+'.pdf"');
    doc.pipe(res);
    doc.end();
  } catch(err) {
    console.error('Attendance report error:',err);
    res.status(500).json({error:err.message});
  }
};
