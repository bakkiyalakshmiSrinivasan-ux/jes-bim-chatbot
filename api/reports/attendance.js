'use strict';
const path = require('path');
const https = require('https');
const http  = require('http');
const jwt   = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-v4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pubhtml?gid=1531829939&single=true';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pubhtml/sheet?headers=false&gid=1097493991';

const FONT_DIR  = path.join(__dirname, '_master', 'fonts');
const printer   = new PdfPrinter({
  DejaVuSans: {
    normal:      path.join(FONT_DIR, 'DejaVuSans.ttf'),
    bold:        path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
    italics:     path.join(FONT_DIR, 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(FONT_DIR, 'DejaVuSans-BoldOblique.ttf'),
  }
});

const HEADER_BG = '#1F3864';
const HEADER_FG = '#FFFFFF';
const TOTAL_BG  = '#BDD7EE';
const ALT_BG    = '#DCE6F1';
const BODY_SIZE = 7;
const HEAD_SIZE = 8;

function verifyToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

function todayLong() {
  return new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', weekday:'long' });
}

function fetchHtml(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 404) { res.resume(); return resolve(''); }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parseArch(html) {
  if (!html) return [];
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [];
    const inner = trM[1];
    const re2 = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdM;
    while ((tdM = re2.exec(inner)) !== null) {
      cells.push(tdM[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim());
    }
    if (cells.length) rows.push(cells);
  }
  if (rows.length < 2) return [];
  const header = rows[1];
  const today = new Date();
  const dd = String(today.getDate()).padStart(2,'0');
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const todayKey = dd+'-'+mm+'-'+String(today.getFullYear());
  let dateCol = -1;
  for (let i = 4; i < header.length; i++) {
    if (header[i] === todayKey) { dateCol = i; break; }
  }
  if (dateCol === -1) {
    for (let i = header.length-1; i >= 4; i--) {
      if (/^\d{2}-\d{2}-\d{4}$/.test(header[i])) { dateCol = i; break; }
    }
  }
  const people = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const name = r[2] || '';
    if (!name) continue;
    people.push({ name, designation: r[3]||'', project: r[1]||'', status: dateCol>=0?(r[dateCol]||''):'' });
  }
  return people;
}

function parseMEP(html) {
  if (!html) return [];
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [];
    const inner = trM[1];
    const re2 = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdM;
    while ((tdM = re2.exec(inner)) !== null) {
      cells.push(tdM[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim());
    }
    if (cells.length) rows.push(cells);
  }
  if (rows.length < 2) return [];
  const header = rows[0];
  const today = new Date();
  const monthAbbr = today.toLocaleString('en-US',{month:'short'});
  const todayKey = monthAbbr+'-'+String(today.getDate()).padStart(2,'0');
  let dateCol = -1;
  for (let i = 7; i < header.length; i++) {
    if (header[i] === todayKey) { dateCol = i; break; }
  }
  if (dateCol === -1) {
    for (let i = header.length-1; i >= 7; i--) {
      if (/^[A-Za-z]+-\d{2}$/.test(header[i])) { dateCol = i; break; }
    }
  }
  const people = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[1] || '';
    if (!name) continue;
    people.push({ name, designation: r[4]||'', project: r[6]||'', status: dateCol>=0?(r[dateCol]||''):'' });
  }
  return people;
}

function lookupProj(code) {
  const map = { 'P001':'Al Bustan','P002':'Downtown','P003':'Marina Gate','P004':'Emaar Hills','P005':'Business Bay','P006':'JLT Tower' };
  return map[code] || code;
}

function aggregateGroup(people) {
  const projMap = {};
  for (const p of people) {
    const n = lookupProj(p.project) || 'Unassigned';
    if (!projMap[n]) projMap[n] = { name: n, members: [] };
    projMap[n].members.push(p);
  }
  return Object.values(projMap);
}

function makeTotalRow(projects) {
  let total=0, active=0, absent=0;
  for (const proj of projects) for (const m of proj.members) {
    total++;
    const s=(m.status||'').toUpperCase();
    if(s==='P'||s==='PRESENT') active++;
    else if(s==='A'||s==='ABSENT') absent++;
  }
  return [
    { text:'TOTAL', bold:true, fillColor:TOTAL_BG, colSpan:3, alignment:'center' },{},{},
    { text:String(total),  bold:true, fillColor:TOTAL_BG, alignment:'center' },
    { text:String(active), bold:true, fillColor:TOTAL_BG, alignment:'center' },
    { text:String(absent), bold:true, fillColor:TOTAL_BG, alignment:'center' },
    { text:total>0?(absent/total*100).toFixed(1)+'%':'-', bold:true, fillColor:TOTAL_BG, alignment:'center' },
    { text:total>0?(active/total*100).toFixed(1)+'%':'-', bold:true, fillColor:TOTAL_BG, alignment:'center' },
  ];
}

function summaryText(projects) {
  let total=0, active=0, absent=0;
  for (const proj of projects) for (const m of proj.members) {
    total++;
    const s=(m.status||'').toUpperCase();
    if(s==='P'||s==='PRESENT') active++;
    else if(s==='A'||s==='ABSENT') absent++;
  }
  return 'Total: '+total+'  |  Active: '+active+'  |  Absent: '+absent+'  |  Absence: '+(total>0?(absent/total*100).toFixed(1)+'%':'-')+'  |  Attendance: '+(total>0?(active/total*100).toFixed(1)+'%':'-');
}

function buildSection(label, projects) {
  const content = [];
  content.push({ table:{ widths:['*'], body:[[{ text:label, fillColor:HEADER_BG, color:HEADER_FG, fontSize:10, bold:true, alignment:'center', margin:[0,4,0,4] }]] }, layout:'noBorders', margin:[0,8,0,0] });
  const tableBody = [[
    { text:'S.NO', style:'th' },{ text:'PROJECT', style:'th' },{ text:'NAME', style:'th' },
    { text:'DESIGNATION', style:'th' },{ text:'TOTAL', style:'th' },{ text:'PRESENT', style:'th' },
    { text:'ABSENT', style:'th' },{ text:'ABSENCE %', style:'th' },{ text:'ATTENDANCE %', style:'th' },
  ]];
  let sno=1;
  for (const proj of projects) {
    tableBody.push([{ text:proj.name, colSpan:9, bold:true, fillColor:'#D9E1F2', fontSize:BODY_SIZE+1, margin:[2,2,2,2] },{},{},{},{},{},{},{},{}]);
    let pT=0,pA=0,pB=0;
    for (const m of proj.members) {
      const s=(m.status||'').toUpperCase();
      const isP=s==='P'||s==='PRESENT', isA=s==='A'||s==='ABSENT';
      pT++; if(isP)pA++; if(isA)pB++;
      const bg=sno%2===0?ALT_BG:'#FFFFFF';
      tableBody.push([
        { text:String(sno++), style:'td', fillColor:bg, alignment:'center' },
        { text:proj.name,     style:'td', fillColor:bg },
        { text:m.name,        style:'td', fillColor:bg },
        { text:m.designation, style:'td', fillColor:bg },
        { text:'1',           style:'td', fillColor:bg, alignment:'center' },
        { text:isP?'1':'0',   style:'td', fillColor:bg, alignment:'center' },
        { text:isA?'1':'0',   style:'td', fillColor:bg, alignment:'center' },
        { text:isA?'100%':'0%', style:'td', fillColor:bg, alignment:'center' },
        { text:isP?'100%':'0%', style:'td', fillColor:bg, alignment:'center' },
      ]);
    }
    tableBody.push([
      { text:'TOTAL', bold:true, fillColor:TOTAL_BG, colSpan:4, alignment:'center', style:'td' },{},{},{},
      { text:String(pT), bold:true, fillColor:TOTAL_BG, alignment:'center', style:'td' },
      { text:String(pA), bold:true, fillColor:TOTAL_BG, alignment:'center', style:'td' },
      { text:String(pB), bold:true, fillColor:TOTAL_BG, alignment:'center', style:'td' },
      { text:pT>0?(pB/pT*100).toFixed(1)+'%':'-', bold:true, fillColor:TOTAL_BG, alignment:'center', style:'td' },
      { text:pT>0?(pA/pT*100).toFixed(1)+'%':'-', bold:true, fillColor:TOTAL_BG, alignment:'center', style:'td' },
    ]);
  }
  tableBody.push(makeTotalRow(projects));
  content.push({ table:{ headerRows:1, widths:[25,70,90,70,30,30,30,35,40], body:tableBody }, layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#AAAAAA', vLineColor:()=>'#AAAAAA' }, margin:[0,0,0,0] });
  content.push({ text:summaryText(projects), fontSize:BODY_SIZE, bold:true, margin:[0,3,0,6], alignment:'right' });
  return content;
}

function buildPdf(archProjects, mepProjects) {
  const all=[...archProjects,...mepProjects];
  let gT=0,gA=0,gB=0;
  for(const p of all) for(const m of p.members) { gT++; const s=(m.status||'').toUpperCase(); if(s==='P'||s==='PRESENT')gA++; if(s==='A'||s==='ABSENT')gB++; }
  const content = [{ stack:[ { text:'JES BIM OPERATIONS', style:'title' }, { text:'Daily Resource Allocation & Attendance Report  |  '+todayLong(), style:'subtitle' } ], margin:[0,0,0,6] }];
  if(archProjects.length>0) for(const c of buildSection('ARCHITECTURE (ARCH) DIVISION',archProjects)) content.push(c);
  if(mepProjects.length>0)  for(const c of buildSection('MEP DIVISION',mepProjects))  content.push(c);
  content.push({ table:{ widths:['*'], body:[[{ text:'GRAND TOTAL  |  Total: '+gT+'  |  Active: '+gA+'  |  Absent: '+gB+'  |  Absence: '+(gT>0?(gB/gT*100).toFixed(1)+'%':'-')+'  |  Attendance: '+(gT>0?(gA/gT*100).toFixed(1)+'%':'-'), bold:true, fontSize:BODY_SIZE+1, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[0,4,0,4] }]] }, layout:'noBorders', margin:[0,6,0,0] });
  return {
    pageSize:'A3', pageOrientation:'landscape', pageMargins:[20,40,20,40],
    defaultStyle:{ font:'DejaVuSans' },
    content,
    footer:(cp,pc)=>({ columns:[ { text:'JES BIM Operations', fontSize:7, color:'#555555', margin:[20,0,0,0] }, { text:todayLong()+'   Page '+cp+' of '+pc, fontSize:7, color:'#555555', alignment:'right', margin:[0,0,20,0] } ] }),
    styles:{ title:{ fontSize:16, bold:true, alignment:'center', color:HEADER_BG, margin:[0,0,0,2] }, subtitle:{ fontSize:9, alignment:'center', color:'#555555', margin:[0,0,0,4] }, th:{ fontSize:HEAD_SIZE, bold:true, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[2,3,2,3] }, td:{ fontSize:BODY_SIZE, margin:[2,2,2,2] } },
  };
}

module.exports = async (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error:'Unauthorized' });
  try {
    const [archHtml, mepHtml] = await Promise.all([fetchHtml(ARCH_URL), fetchHtml(MEP_URL)]);
    const archProjects = aggregateGroup(parseArch(archHtml));
    const mepProjects  = aggregateGroup(parseMEP(mepHtml));
    const docDef = buildPdf(archProjects, mepProjects);
    const doc = printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','inline; filename="attendance.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error('attendance error:', err);
    res.status(500).json({ error: err.message });
  }
};
