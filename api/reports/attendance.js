'use strict';
const path = require('path');
const PdfPrinter = require('pdfmake');
const jwt = require('jsonwebtoken');

// CSV export URLs
const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-v4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pub?gid=1531829939&single=true&output=csv';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pub?gid=1097493991&single=true&output=csv';

const HEADER_BG = '#1F3864';
const HEADER_FG = '#FFFFFF';
const TOTAL_BG  = '#BDD7EE';
const ALT_BG    = '#DCE6F1';
const SUB_BG    = '#D9E1F2';
const BODY_SIZE = 7;
const HEAD_SIZE = 8;
const COLS      = 9;

const fonts = {
  DejaVu: {
    normal:      path.join(__dirname, '_master', 'fonts', 'DejaVuSans.ttf'),
    bold:        path.join(__dirname, '_master', 'fonts', 'DejaVuSans-Bold.ttf'),
    italics:     path.join(__dirname, '_master', 'fonts', 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(__dirname, '_master', 'fonts', 'DejaVuSans-BoldOblique.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

function todayLabel() {
  const d = new Date();
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const day  = d.toLocaleDateString('en-GB', { weekday: 'long' });
  return date + ' · ' + day;
}

function fetchText(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 404) { res.resume(); return resolve(''); }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  return text.split('\n').map(parseCSVLine);
}

function isAbsent(status) {
  const s = (status || '').toLowerCase().trim();
  return s.includes('leave') || s === 'a' || s === 'absent' || s === 'holiday';
}

function isWeekoff(status) {
  const s = (status || '').toLowerCase().trim();
  return s === '' || s.includes('week') || s === 'weekoff' || s === 'week off';
}

function findBestDateCol(headers, startIdx, todayKey, isDateHeader, rows) {
  let todayCol = -1;
  let lastDateCol = -1;
  for (let i = startIdx; i < headers.length; i++) {
    if (!isDateHeader(headers[i])) continue;
    lastDateCol = i;
    if (headers[i] === todayKey) todayCol = i;
  }
  if (todayCol >= 0) {
    const hasWork = rows.some(r => { const v = (r[todayCol] || '').trim(); return v && !isWeekoff(v); });
    if (hasWork) return todayCol;
  }
  for (let col = lastDateCol; col >= startIdx; col--) {
    if (!isDateHeader(headers[col])) continue;
    const hasWork = rows.some(r => { const v = (r[col] || '').trim(); return v && !isWeekoff(v) && !isAbsent(v); });
    if (hasWork) return col;
  }
  return lastDateCol;
}

function categorize(desig) {
  const d = (desig || '').toLowerCase();
  if (d.includes('intern') || d.includes('trainee') || d.includes('junior')) return 'intern';
  if (d.includes('senior')) return 'senior';
  if (d.includes('coordinator') || d.includes('lead') || d.includes('manager')) return 'coordinator';
  return 'modeler';
}

// ARCH: row[0]=blank, row[1]=week labels, row[2]=headers(r[8+]=DD-MM-YYYY), row[3]=day names, row[4+]=data
// data: r[1]=client, r[2]=name, r[3]=designation, r[8+]=daily status
function parseArch(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 5) return [];
  const header = rows[2];
  const validDesig = d => /coordinator|modeler|modeller|manager|lead|intern|trainee/i.test(d || '');
  const dataRows = rows.slice(4).filter(r => (r[2] || '').trim() !== '' && validDesig(r[3]));
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = String(today.getFullYear());
  const todayKey = dd + '-' + mm + '-' + yyyy;
  const isDateHeader = h => /^\d{2}-\d{2}-\d{4}$/.test(h);
  const dateCol = findBestDateCol(header, 8, todayKey, isDateHeader, dataRows);
  const people = [];
  for (const r of dataRows) {
    const name   = (r[2] || '').trim();
    if (!name) continue;
    const client = (r[1] || 'JES').trim() || 'JES';
    const desig  = (r[3] || '').trim();
    const status = dateCol >= 0 ? (r[dateCol] || '').trim() : '';
    const absent = isAbsent(status);
    const weekoff = isWeekoff(status);
    let project = '';
    if (absent) {
      for (let col = dateCol - 1; col >= 8; col--) {
        if (!isDateHeader(header[col])) continue;
        const v = (r[col] || '').trim();
        if (v && !isWeekoff(v) && !isAbsent(v)) { project = v; break; }
      }
      if (!project) project = client;
    } else if (!weekoff && status) {
      project = status;
    } else {
      continue;
    }
    people.push({ client, name, designation: desig, project, absent });
  }
  return people;
}

// MEP: row[0]=header(r[6+]=May-DD), row[1+]=data
// data: r[1]=name, r[2]=dept, r[3]=designation, r[5]=default_project, r[6+]=daily status
function parseMEP(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];
  const header = rows[0];
  const dataRows = rows.slice(1).filter(r => (r[1] || '').trim() !== '' && (r[1] || '') !== 'Employees');
  const today = new Date();
  const monthAbbr = today.toLocaleString('en-US', { month: 'short' });
  const dayStr = String(today.getDate()).padStart(2, '0');
  const todayKey = monthAbbr + '-' + dayStr;
  const isDateHeader = h => /^[A-Za-z]+-\d{2}$/.test(h);
  const dateCol = findBestDateCol(header, 6, todayKey, isDateHeader, dataRows);
  const people = [];
  for (const r of dataRows) {
    const name    = (r[1] || '').trim();
    if (!name) continue;
    const dept    = (r[2] || 'MEP').trim() || 'MEP';
    const desig   = (r[3] || '').trim();
    const defProj = (r[5] || '').trim();
    const status  = dateCol >= 0 ? (r[dateCol] || '').trim() : '';
    const absent  = isAbsent(status);
    const weekoff = isWeekoff(status);
    let project = '';
    if (absent) {
      project = defProj || dept;
    } else if (!weekoff && status) {
      project = status;
    } else {
      continue;
    }
    people.push({ client: dept, name, designation: desig, project, absent });
  }
  return people;
}

function aggregatePeople(people) {
  const map = {};
  for (const p of people) {
    const key = p.client + '||' + p.project;
    if (!map[key]) {
      map[key] = { client: p.client, project: p.project,
                   coordinator: 0, senior: 0, modeler: 0, intern: 0, absent: 0, total: 0 };
    }
    const e = map[key];
    e.total++;
    if (p.absent) {
      e.absent++;
    } else {
      const cat = categorize(p.designation);
      if (cat === 'coordinator') e.coordinator++;
      else if (cat === 'senior') e.senior++;
      else if (cat === 'intern') e.intern++;
      else e.modeler++;
    }
  }
  return Object.values(map);
}

function makeHeaderRow() {
  return [
    { text: 'Client Name',       style: 'th' },
    { text: 'Project Name',      style: 'th' },
    { text: 'BIM\nCoordinator',  style: 'th' },
    { text: 'Senior\nModeler',   style: 'th' },
    { text: 'BIM\nModeler',      style: 'th' },
    { text: 'Interns',           style: 'th' },
    { text: 'Absent',            style: 'th' },
    { text: 'No. of\nResources', style: 'th' },
    { text: 'Active\nResources', style: 'th' },
  ];
}

function makeProjectRow(proj, bg) {
  const active = proj.total - proj.absent;
  const c = v => (v > 0 ? String(v) : '');
  return [
    { text: proj.client,         style: 'td', fillColor: bg },
    { text: proj.project,        style: 'td', fillColor: bg },
    { text: c(proj.coordinator), style: 'td', fillColor: bg, alignment: 'center' },
    { text: c(proj.senior),      style: 'td', fillColor: bg, alignment: 'center' },
    { text: c(proj.modeler),     style: 'td', fillColor: bg, alignment: 'center' },
    { text: c(proj.intern),      style: 'td', fillColor: bg, alignment: 'center' },
    { text: proj.absent > 0 ? String(proj.absent) : '', style: 'td', fillColor: bg, alignment: 'center' },
    { text: String(proj.total),  style: 'td', fillColor: bg, alignment: 'center', bold: true },
    { text: String(active),      style: 'td', fillColor: bg, alignment: 'center', bold: true },
  ];
}

function makeSectionTotalRow(projects) {
  let coord=0, senior=0, modeler=0, intern=0, absent=0, total=0;
  for (const p of projects) {
    coord += p.coordinator||0; senior += p.senior||0; modeler += p.modeler||0;
    intern += p.intern||0; absent += p.absent||0; total += p.total||0;
  }
  const active = total - absent;
  const cell = v => ({ text: String(v), bold: true, fillColor: TOTAL_BG, alignment: 'center', style: 'td' });
  return [
    { text: 'TOTAL', bold: true, fillColor: TOTAL_BG, colSpan: 2, alignment: 'center', style: 'td' }, {},
    cell(coord), cell(senior), cell(modeler), cell(intern), cell(absent), cell(total), cell(active),
  ];
}

function summaryLine(projects) {
  let total=0, absent=0;
  for (const p of projects) { total += p.total; absent += p.absent; }
  const active = total - absent;
  const absP = total > 0 ? (absent/total*100).toFixed(1)+'%' : '-';
  const attP = total > 0 ? (active/total*100).toFixed(1)+'%' : '-';
  return 'Total: '+total+'  |  Active: '+active+'  |  Absent: '+absent+'  |  Absence: '+absP+'  |  Attendance: '+attP;
}

function buildSection(label, projects) {
  const content = [];
  content.push({
    table: { widths: ['*'], body: [[
      { text: label, bold: true, fontSize: 10, color: HEADER_FG,
        fillColor: HEADER_BG, alignment: 'center', margin: [0,4,0,4] }
    ]]},
    layout: 'noBorders', margin: [0,8,0,0],
  });
  const tableBody = [];
  tableBody.push(makeHeaderRow());
  const isResource = p => { const proj=(p.project||'').toLowerCase(); return proj==='internal'||proj.startsWith('t_')||proj.startsWith('i_'); };
  const lumpsumProjs  = projects.filter(p => !isResource(p));
  const resourceProjs = projects.filter(p => isResource(p));
  if (lumpsumProjs.length > 0) {
    tableBody.push([{ text:'A) Lumpsum Projects', colSpan:COLS, bold:true, fillColor:SUB_BG, fontSize:BODY_SIZE+1, margin:[4,3,2,3] },{},{},{},{},{},{},{},{}]);
    lumpsumProjs.forEach((p,i) => tableBody.push(makeProjectRow(p, i%2===0?'#FFFFFF':ALT_BG)));
  }
  if (resourceProjs.length > 0) {
    tableBody.push([{ text:'B) Resource Projects', colSpan:COLS, bold:true, fillColor:SUB_BG, fontSize:BODY_SIZE+1, margin:[4,3,2,3] },{},{},{},{},{},{},{},{}]);
    resourceProjs.forEach((p,i) => tableBody.push(makeProjectRow(p, i%2===0?'#FFFFFF':ALT_BG)));
  }
  tableBody.push(makeSectionTotalRow(projects));
  content.push({
    table: { headerRows:1, widths:[65,75,35,35,35,30,30,35,35], body:tableBody },
    layout: { hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#AAAAAA', vLineColor:()=>'#AAAAAA' },
    margin:[0,0,0,0],
  });
  content.push({ text:summaryLine(projects), fontSize:BODY_SIZE, bold:true, margin:[0,3,0,6], alignment:'right' });
  return content;
}

function buildPdf(archProjects, mepProjects) {
  const all = [...archProjects, ...mepProjects];
  let total=0, absent=0;
  for (const p of all) { total+=p.total; absent+=p.absent; }
  const active = total-absent;
  const absP = total>0?(absent/total*100).toFixed(1)+'%':'-';
  const attP = total>0?(active/total*100).toFixed(1)+'%':'-';
  const content = [];
  content.push({ stack:[
    { text:'JES BIM Operations', style:'title' },
    { text:'JES Resource Updates  |  '+todayLabel(), style:'subtitle' },
  ], margin:[0,0,0,6] });
  if (archProjects.length>0) { for (const c of buildSection('ARCH',archProjects)) content.push(c); }
  else { content.push({ text:'ARCH — no data available for this date.', style:'subtitle', margin:[0,6,0,6] }); }
  if (mepProjects.length>0) { for (const c of buildSection('MEP',mepProjects)) content.push(c); }
  else { content.push({ text:'MEP — no data available for this date.', style:'subtitle', margin:[0,6,0,6] }); }
  content.push({
    table:{ widths:['*'], body:[[{ text:'GRAND TOTAL  |  Total: '+total+'  |  Active: '+active+'  |  Absent: '+absent+'  |  Absence: '+absP+'  |  Attendance: '+attP, bold:true, fontSize:BODY_SIZE+1, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[0,4,0,4] }]] },
    layout:'noBorders', margin:[0,6,0,0],
  });
  return {
    pageSize:'A4', pageOrientation:'landscape', pageMargins:[20,40,20,40],
    content,
    footer:(currentPage,pageCount) => ({ columns:[
      { text:'JES BIM Operations', fontSize:7, color:'#555555', margin:[20,0,0,0] },
      { text:todayLabel()+'   |   Page '+currentPage+' of '+pageCount, fontSize:7, color:'#555555', alignment:'right', margin:[0,0,20,0] },
    ]}),
    styles:{
      title:   { fontSize:16, bold:true, alignment:'center', color:HEADER_BG, margin:[0,0,0,2] },
      subtitle:{ fontSize:9,  alignment:'center', color:'#555555', margin:[0,0,0,4] },
      th:{ fontSize:HEAD_SIZE, bold:true, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[2,3,2,3] },
      td:{ fontSize:BODY_SIZE, margin:[2,2,2,2] },
    },
    defaultStyle:{ font:'DejaVu' },
  };
}

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ','').trim();
  try { jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error:'Unauthorized' }); }
  try {
    const [archCsv, mepCsv] = await Promise.all([fetchText(ARCH_URL), fetchText(MEP_URL)]);
    const archProjects = aggregatePeople(parseArch(archCsv));
    const mepProjects  = aggregatePeople(parseMEP(mepCsv));
    const docDef = buildPdf(archProjects, mepProjects);
    const doc = printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','inline; filename="attendance.pdf"');
    doc.pipe(res);
    doc.end();
  } catch(err) {
    console.error('attendance error:', err);
    res.status(500).json({ error:err.message });
  }
};
