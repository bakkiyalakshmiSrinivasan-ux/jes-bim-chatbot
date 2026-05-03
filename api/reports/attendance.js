'use strict';
const path = require('path');
const PdfPrinter = require('pdfmake');
const jwt = require('jsonwebtoken');

// CSV export URLs
const ARCH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTddy7fI-v4N3Osrlp3S6Xgb-FxV7CsVspthy9HS4vmL-T4V1ACI69RbLEhW3g_pnCg7UywMjFRcTD/pub?gid=1531829939&single=true&output=csv';
const MEP_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtieUAIWU0gdPsg3LTaOZar6Va9MJ2NP9SJV4kQ0R77NC3oT78Y7fmVMngiLb-4HuOpPfAOjClqhvy/pub?gid=1097493991&single=true&output=csv';

// ââ Colours âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const HEADER_BG = '#1F3864';
const HEADER_FG = '#FFFFFF';
const ACCENT_BG = '#2E5A99';
const TOTAL_BG  = '#BDD7EE';
const ALT_BG    = '#DCE6F1';
const SUB_BG    = '#D9E1F2';
const ABSENT_BG = '#FFD7D7';
const PRESENT_BG = '#E8F5E9';
const BODY_SIZE = 7;
const HEAD_SIZE = 8;
const COLS = 9;

const fonts = {
  DejaVu: {
    normal:      path.join(__dirname, '_master', 'fonts', 'DejaVuSans.ttf'),
    bold:        path.join(__dirname, '_master', 'fonts', 'DejaVuSans-Bold.ttf'),
    italics:     path.join(__dirname, '_master', 'fonts', 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(__dirname, '_master', 'fonts', 'DejaVuSans-BoldOblique.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

// ââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function todayLabel() {
  const d    = new Date();
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const day  = d.toLocaleDateString('en-GB', { weekday: 'long' });
  return date + ' Â· ' + day;
}

function fetchText(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 404 || res.statusCode === 403) { res.resume(); return resolve(''); }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchText(res.headers.location).then(resolve);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  return (text || '').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(parseCSVLine);
}

function isAbsent(status) {
  const s = (status || '').toLowerCase().trim();
  return s.includes('leave') || s === 'a' || s === 'absent' || s === 'holiday';
}

function isWeekoff(status) {
  const s = (status || '').toLowerCase().trim();
  return s === '' || s.includes('week') || s === 'weekoff' || s === 'week off';
}

function categorize(desig) {
  const d = (desig || '').toLowerCase();
  if (d.includes('intern') || d.includes('trainee') || d.includes('junior')) return 'Intern';
  if (d.includes('senior')) return 'Senior';
  if (d.includes('coordinator') || d.includes('lead') || d.includes('manager')) return 'Coordinator';
  return 'Modeler';
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  DAILY MODE â existing behaviour
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function findBestDateCol(headers, startIdx, todayKey, isDateHeader, rows) {
  let todayCol = -1; let lastDateCol = -1;
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

function parseArch(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 5) return [];
  const header = rows[2];
  const validDesig = d => /coordinator|modeler|modeller|manager|lead|intern|trainee/i.test(d || '');
  const dataRows = rows.slice(4).filter(r => (r[2] || '').trim() !== '' && validDesig(r[3]));
  const today = new Date();
  const dd = String(today.getDate()).padStart(2,'0');
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const yyyy = String(today.getFullYear());
  const todayKey = dd + '-' + mm + '-' + yyyy;
  const isDateHeader = h => /^\d{2}-\d{2}-\d{4}$/.test(h);
  const dateCol = findBestDateCol(header, 8, todayKey, isDateHeader, dataRows);
  const people = [];
  for (const r of dataRows) {
    const name = (r[2] || '').trim(); if (!name) continue;
    const client = (r[1] || 'JES').trim() || 'JES';
    const desig  = (r[3] || '').trim();
    const status = dateCol >= 0 ? (r[dateCol] || '').trim() : '';
    const absent  = isAbsent(status);
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
    } else { continue; }
    people.push({ client, name, designation: desig, project, absent });
  }
  return people;
}

function parseMEP(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];
  const header  = rows[0];
  const dataRows = rows.slice(1).filter(r => (r[1] || '').trim() !== '' && (r[1] || '') !== 'Employees');
  const today    = new Date();
  const monthAbbr = today.toLocaleString('en-US', { month: 'short' });
  const dayStr    = String(today.getDate()).padStart(2,'0');
  const todayKey  = monthAbbr + '-' + dayStr;
  const isDateHeader = h => /^[A-Za-z]+-\d{2}$/.test(h);
  const dateCol = findBestDateCol(header, 6, todayKey, isDateHeader, dataRows);
  const people = [];
  for (const r of dataRows) {
    const name = (r[1] || '').trim(); if (!name) continue;
    const dept   = (r[2] || 'MEP').trim() || 'MEP';
    const desig  = (r[3] || '').trim();
    const defProj = (r[5] || '').trim();
    const status  = dateCol >= 0 ? (r[dateCol] || '').trim() : '';
    const absent  = isAbsent(status);
    const weekoff = isWeekoff(status);
    let project = '';
    if (absent) { project = defProj || dept; }
    else if (!weekoff && status) { project = status; }
    else { continue; }
    people.push({ client: dept, name, designation: desig, project, absent });
  }
  return people;
}

function aggregatePeople(people) {
  const map = {};
  for (const p of people) {
    const key = p.client + '||' + p.project;
    if (!map[key]) map[key] = { client: p.client, project: p.project, coordinator: 0, senior: 0, modeler: 0, intern: 0, absent: 0, total: 0 };
    const e = map[key]; e.total++;
    if (p.absent) { e.absent++; }
    else { const cat = categorize(p.designation); if (cat==='Coordinator') e.coordinator++; else if (cat==='Senior') e.senior++; else if (cat==='Intern') e.intern++; else e.modeler++; }
  }
  return Object.values(map);
}

function makeHeaderRow() {
  return [
    { text: 'Client Name',     style: 'th' }, { text: 'Project Name',      style: 'th' },
    { text: 'BIM\nCoordinator',style: 'th' }, { text: 'Senior\nModeler',   style: 'th' },
    { text: 'BIM\nModeler',    style: 'th' }, { text: 'Interns',           style: 'th' },
    { text: 'Absent',          style: 'th' }, { text: 'No. of\nResources', style: 'th' },
    { text: 'Active\nResources',style:'th' },
  ];
}

function makeProjectRow(proj, bg) {
  const active = proj.total - proj.absent;
  const c = v => (v > 0 ? String(v) : '');
  return [
    { text: proj.client,  style: 'td', fillColor: bg }, { text: proj.project, style: 'td', fillColor: bg },
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
  let coord=0,senior=0,modeler=0,intern=0,absent=0,total=0;
  for (const p of projects) { coord+=p.coordinator||0; senior+=p.senior||0; modeler+=p.modeler||0; intern+=p.intern||0; absent+=p.absent||0; total+=p.total||0; }
  const active = total - absent;
  const cell = v => ({ text: String(v), bold: true, fillColor: TOTAL_BG, alignment: 'center', style: 'td' });
  return [{ text: 'TOTAL', bold: true, fillColor: TOTAL_BG, colSpan: 2, alignment: 'center', style: 'td' }, {}, cell(coord), cell(senior), cell(modeler), cell(intern), cell(absent), cell(total), cell(active)];
}

function summaryLine(projects) {
  let total=0,absent=0; for (const p of projects) { total+=p.total; absent+=p.absent; }
  const active = total - absent;
  const absP = total > 0 ? (absent/total*100).toFixed(1)+'%' : '-';
  const attP = total > 0 ? (active/total*100).toFixed(1)+'%' : '-';
  return 'Total: '+total+' | Active: '+active+' | Absent: '+absent+' | Absence: '+absP+' | Attendance: '+attP;
}

function buildSection(label, projects) {
  const content = [];
  content.push({ table: { widths: ['*'], body: [[{ text: label, bold: true, fontSize: 10, color: HEADER_FG, fillColor: HEADER_BG, alignment: 'center', margin: [0,4,0,4] }]] }, layout: 'noBorders', margin: [0,8,0,0] });
  const tableBody = [];
  tableBody.push(makeHeaderRow());
  const isResource = p => { const proj=(p.project||'').toLowerCase(); return proj==='internal'||proj.startsWith('t_')||proj.startsWith('i_'); };
  const lumpsumProjs  = projects.filter(p => !isResource(p));
  const resourceProjs = projects.filter(p =>  isResource(p));
  if (lumpsumProjs.length > 0) {
    tableBody.push([{ text:'A) Lumpsum Projects',  colSpan:COLS, bold:true, fillColor:SUB_BG, fontSize:BODY_SIZE+1, margin:[4,3,2,3] },{},{},{},{},{},{},{},{}]);
    lumpsumProjs.forEach((p,i) => tableBody.push(makeProjectRow(p, i%2===0?'#FFFFFF':ALT_BG)));
  }
  if (resourceProjs.length > 0) {
    tableBody.push([{ text:'B) Resource Projects', colSpan:COLS, bold:true, fillColor:SUB_BG, fontSize:BODY_SIZE+1, margin:[4,3,2,3] },{},{},{},{},{},{},{}]);
    resourceProjs.forEach((p,i) => tableBody.push(makeProjectRow(p, i%2===0?'#FFFFFF':ALT_BG)));
  }
  tableBody.push(makeSectionTotalRow(projects));
  content.push({ table: { headerRows:1, widths:[65,75,35,35,35,30,30,35,35], body:tableBody }, layout: { hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#AAAAAA', vLineColor:()=>'#AAAAAA' }, margin:[0,0,0,0] });
  content.push({ text: summaryLine(projects), fontSize:BODY_SIZE, bold:true, margin:[0,3,0,6], alignment:'right' });
  return content;
}

function buildDailyPdf(archProjects, mepProjects) {
  const all = [...archProjects, ...mepProjects];
  let total=0, absent=0;
  for (const p of all) { total+=p.total; absent+=p.absent; }
  const active = total - absent;
  const absP = total>0?(absent/total*100).toFixed(1)+'%':'-';
  const attP = total>0?(active/total*100).toFixed(1)+'%':'-';
  const content = [];
  content.push({ stack: [{ text:'JES BIM Operations', style:'title' }, { text:'JES Resource Updates | '+todayLabel(), style:'subtitle' }], margin:[0,0,0,6] });
  if (archProjects.length>0) for (const c of buildSection('ARCH', archProjects)) content.push(c);
  else content.push({ text:'ARCH â no data available for this date.', style:'subtitle', margin:[0,6,0,6] });
  if (mepProjects.length>0) for (const c of buildSection('MEP', mepProjects)) content.push(c);
  else content.push({ text:'MEP â no data available for this date.', style:'subtitle', margin:[0,6,0,6] });
  content.push({ table:{ widths:['*'], body:[[{ text:'GRAND TOTAL | Total: '+total+' | Active: '+active+' | Absent: '+absent+' | Absence: '+absP+' | Attendance: '+attP, bold:true, fontSize:BODY_SIZE+1, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[0,4,0,4] }]] }, layout:'noBorders', margin:[0,6,0,0] });
  return {
    pageSize:'A4', pageOrientation:'landscape', pageMargins:[20,40,20,40], content,
    footer:(currentPage,pageCount) => ({ columns:[{ text:'JES BIM Operations', fontSize:7, color:'#555555', margin:[20,0,0,0] }, { text:todayLabel()+' | Page '+currentPage+' of '+pageCount, fontSize:7, color:'#555555', alignment:'right', margin:[0,0,20,0] }] }),
    styles:{ title:{ fontSize:16, bold:true, alignment:'center', color:HEADER_BG, margin:[0,0,0,2] }, subtitle:{ fontSize:9, alignment:'center', color:'#555555', margin:[0,0,0,4] }, th:{ fontSize:HEAD_SIZE, bold:true, fillColor:HEADER_BG, color:HEADER_FG, alignment:'center', margin:[2,3,2,3] }, td:{ fontSize:BODY_SIZE, margin:[2,2,2,2] } },
    defaultStyle:{ font:'DejaVu' },
  };
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  MONTHLY PA MODE â new
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function parseArchMonthly(csv, targetYear, targetMonth) {
  const rows = parseCSV(csv);
  if (rows.length < 5) return [];
  const header = rows[2];

  // Collect all column indices for dates in target month (DD-MM-YYYY)
  const monthCols = [];
  for (let i = 8; i < header.length; i++) {
    const h = (header[i] || '').trim();
    if (!/^\d{2}-\d{2}-\d{4}$/.test(h)) continue;
    const parts = h.split('-');
    if (parseInt(parts[2]) === targetYear && parseInt(parts[1]) === targetMonth + 1)
      monthCols.push(i);
  }
  if (monthCols.length === 0) return [];

  const validDesig = d => /coordinator|modeler|modeller|manager|lead|intern|trainee/i.test(d || '');
  const dataRows = rows.slice(4).filter(r => (r[2] || '').trim() && validDesig(r[3]));

  const people = [];
  for (const r of dataRows) {
    const name = (r[2] || '').trim(); if (!name) continue;
    const client = (r[1] || 'JES').trim() || 'JES';
    const desig  = (r[3] || '').trim();
    let daysPresent = 0, daysAbsent = 0;
    const projCount = {};
    for (const col of monthCols) {
      const status = (r[col] || '').trim();
      if (isWeekoff(status)) continue;
      if (isAbsent(status)) { daysAbsent++; }
      else if (status) { daysPresent++; projCount[status] = (projCount[status] || 0) + 1; }
    }
    if (daysPresent === 0 && daysAbsent === 0) continue;
    const project = Object.entries(projCount).sort((a,b) => b[1]-a[1])[0]?.[0] || client;
    people.push({ dept:'ARCH', client, name, designation: desig, role: categorize(desig), project, daysPresent, daysAbsent, workingDays: monthCols.length });
  }
  return people;
}

function parseMEPMonthly(csv, targetYear, targetMonth) {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];
  const header = rows[0];

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const targetAbbr = MONTHS[targetMonth];
  const monthCols = [];
  for (let i = 6; i < header.length; i++) {
    const h = (header[i] || '').trim();
    if (!/^[A-Za-z]+-\d{2}$/.test(h)) continue;
    if (h.startsWith(targetAbbr + '-')) monthCols.push(i);
  }
  if (monthCols.length === 0) return [];

  const dataRows = rows.slice(1).filter(r => (r[1] || '').trim() && (r[1] || '') !== 'Employees');

  const people = [];
  for (const r of dataRows) {
    const name = (r[1] || '').trim(); if (!name) continue;
    const dept    = (r[2] || 'MEP').trim() || 'MEP';
    const desig   = (r[3] || '').trim();
    const defProj = (r[5] || '').trim();
    let daysPresent = 0, daysAbsent = 0;
    const projCount = {};
    for (const col of monthCols) {
      const status = (r[col] || '').trim();
      if (isWeekoff(status)) continue;
      if (isAbsent(status)) { daysAbsent++; }
      else if (status) { daysPresent++; projCount[status] = (projCount[status] || 0) + 1; }
    }
    if (daysPresent === 0 && daysAbsent === 0) continue;
    const project = Object.entries(projCount).sort((a,b) => b[1]-a[1])[0]?.[0] || defProj || dept;
    people.push({ dept, client: dept, name, designation: desig, role: categorize(desig), project, daysPresent, daysAbsent, workingDays: monthCols.length });
  }
  return people;
}

function buildMonthlyPdf(archPeople, mepPeople, monthLabel, reportId) {
  const all = [...archPeople, ...mepPeople];
  const totalManDays = all.reduce((s,p) => s + p.daysPresent, 0);
  const today = new Date();
  const issueDateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Group people by dept then project
  function groupByProject(people) {
    const map = {};
    for (const p of people) {
      if (!map[p.project]) map[p.project] = [];
      map[p.project].push(p);
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
  }

  const content = [];

  // ââ Cover ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  content.push({
    table: { widths: ['*', 155], body: [[
      { stack: [
          { text: 'JES BIM Operations',     fontSize: 9, bold: true, color: HEADER_FG, margin: [0,0,0,4] },
          { text: 'Monthly Project Allocation', fontSize: 24, bold: true, color: HEADER_FG, margin: [0,0,0,6] },
          { text: monthLabel + ' â Resource Distribution Report', fontSize: 9, color: '#BBCCDD' },
        ], fillColor: HEADER_BG, margin: [18,16,12,16] },
      { stack: [
          { text: 'REPORT PERIOD',    fontSize: 6.5, bold: true, color: '#BBBBBB', margin: [0,0,0,2] },
          { text: monthLabel,         fontSize: 11,  bold: true, color: HEADER_FG,  margin: [0,0,0,10] },
          { text: 'ISSUE DATE',       fontSize: 6.5, bold: true, color: '#BBBBBB', margin: [0,0,0,2] },
          { text: issueDateStr,       fontSize: 11,  bold: true, color: HEADER_FG,  margin: [0,0,0,10] },
          { text: 'REPORT ID',        fontSize: 6.5, bold: true, color: '#BBBBBB', margin: [0,0,0,2] },
          { text: reportId,           fontSize: 9,   bold: true, color: HEADER_FG },
        ], fillColor: ACCENT_BG, margin: [12,16,14,16] },
    ]] }, layout: 'noBorders', margin: [0,0,0,12],
  });

  // ââ Summary Row âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const mkStat = (lbl, val) => ({ stack: [{ text: String(val), fontSize: 18, bold: true, color: HEADER_BG, alignment: 'center' }, { text: lbl, fontSize: 7, color: '#666666', alignment: 'center', margin: [0,2,0,0] }], margin: [4,6,4,6] });
  content.push({
    table: { widths: ['*','*','*','*'], body: [[mkStat('Total Staff', all.length), mkStat('Man-Days', totalManDays), mkStat('ARCH Staff', archPeople.length), mkStat('MEP Staff', mepPeople.length)]] },
    layout: { hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#DDDDDD', vLineColor:()=>'#DDDDDD' },
    margin: [0,0,0,14],
  });

  // ââ Section builder ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function monthlySection(label, people) {
    if (people.length === 0) {
      content.push({ text: label + ' â no data available for ' + monthLabel + '.', fontSize: 9, color: '#888888', margin: [0,6,0,6] });
      return;
    }
    content.push({ table: { widths: ['*'], body: [[{ text: label, bold: true, fontSize: 10, color: HEADER_FG, fillColor: HEADER_BG, alignment: 'center', margin: [0,5,0,5] }]] }, layout: 'noBorders', margin: [0,10,0,4] });

    for (const [projName, projPeople] of groupByProject(people)) {
      const sorted = projPeople.slice().sort((a,b) => a.name.localeCompare(b.name));
      const totPresent = sorted.reduce((s,p) => s+p.daysPresent, 0);
      const totAbsent  = sorted.reduce((s,p) => s+p.daysAbsent, 0);
      const overallAtt = (totPresent + totAbsent) > 0 ? Math.round(totPresent/(totPresent+totAbsent)*100) : 0;

      // Project sub-header
      content.push({ table: { widths: ['*'], body: [[{ text: projName, bold: true, fontSize: 8.5, color: HEADER_BG, fillColor: SUB_BG, margin: [6,3,6,3] }]] }, layout: 'noBorders', margin: [0,4,0,0] });

      const hdr = [
        { text: 'Staff Name',    style: 'mth' }, { text: 'Role',      style: 'mth' },
        { text: 'Designation',   style: 'mth' }, { text: 'Present',   style: 'mth' },
        { text: 'Absent',        style: 'mth' }, { text: 'Man-Days',  style: 'mth' },
        { text: 'Attendance %',  style: 'mth' },
      ];
      const bodyRows = sorted.map((p, i) => {
        const bg  = i % 2 === 0 ? '#FFFFFF' : ALT_BG;
        const att = (p.daysPresent + p.daysAbsent) > 0 ? Math.round(p.daysPresent/(p.daysPresent+p.daysAbsent)*100) : 0;
        const attColor = att >= 90 ? '#1A6B1A' : att >= 70 ? '#884400' : '#CC0000';
        return [
          { text: p.name,                  style: 'mtd', fillColor: bg },
          { text: p.role,                  style: 'mtd', fillColor: bg, alignment: 'center' },
          { text: p.designation || 'â',    style: 'mtd', fillColor: bg, color: '#555555' },
          { text: p.daysPresent,            style: 'mtd', fillColor: bg, alignment: 'center', bold: true, color: '#1A6B1A' },
          { text: p.daysAbsent || '',       style: 'mtd', fillColor: p.daysAbsent > 0 ? ABSENT_BG : bg, alignment: 'center', color: p.daysAbsent > 0 ? '#CC0000' : '#000000' },
          { text: p.daysPresent,            style: 'mtd', fillColor: bg, alignment: 'center' },
          { text: att + '%',                style: 'mtd', fillColor: bg, alignment: 'center', color: attColor, bold: true },
        ];
      });
      // Total row
      bodyRows.push([
        { text: 'TOTAL', bold: true, style: 'mtd', fillColor: TOTAL_BG, colSpan: 3 }, {}, {},
        { text: totPresent, bold: true, style: 'mtd', fillColor: TOTAL_BG, alignment: 'center' },
        { text: totAbsent || '', bold: true, style: 'mtd', fillColor: TOTAL_BG, alignment: 'center' },
        { text: totPresent, bold: true, style: 'mtd', fillColor: TOTAL_BG, alignment: 'center' },
        { text: overallAtt + '%', bold: true, style: 'mtd', fillColor: TOTAL_BG, alignment: 'center', color: overallAtt >= 90 ? '#1A6B1A' : overallAtt >= 70 ? '#884400' : '#CC0000' },
      ]);

      content.push({
        table: { headerRows: 1, widths: [110, 55, 90, 42, 42, 42, 55], body: [hdr, ...bodyRows] },
        layout: { hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#CCCCCC', vLineColor:()=>'#CCCCCC' },
        margin: [0,0,0,4],
      });
    }
  }

  monthlySection('ARCHITECTURAL (ARCH)', archPeople);
  monthlySection('MEP', mepPeople);

  if (all.length === 0) {
    content.push({ text: 'No allocation data found for ' + monthLabel + '.\n\nPlease ensure the Google Sheets are published to web as CSV and include date columns for this month.', fontSize: 10, color: '#CC7700', margin: [0,16,0,0] });
  }

  return {
    pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [22, 48, 22, 42], content,
    header: (currentPage) => {
      if (currentPage === 1) return {};
      return { columns: [{ text: 'Monthly Project Allocation â ' + monthLabel, fontSize: 8, bold: true, color: HEADER_BG, margin: [22,14,0,0] }, { text: reportId, fontSize: 7, color: '#888888', alignment: 'right', margin: [0,14,22,0] }] };
    },
    footer: (currentPage, pageCount) => ({ columns: [{ text: 'JES BIM Operations Â· Confidential', fontSize: 7, color: '#888888', margin: [22,0,0,0] }, { text: 'Generated ' + issueDateStr, fontSize: 7, color: '#888888', alignment: 'center' }, { text: 'Page ' + currentPage + ' of ' + pageCount, fontSize: 7, color: '#888888', alignment: 'right', margin: [0,0,22,0] }] }),
    styles: {
      mth: { fontSize: HEAD_SIZE, bold: true, fillColor: HEADER_BG, color: HEADER_FG, alignment: 'center', margin: [2,3,2,3] },
      mtd: { fontSize: BODY_SIZE, margin: [3,2,3,2] },
      th:  { fontSize: HEAD_SIZE, bold: true, fillColor: HEADER_BG, color: HEADER_FG, alignment: 'center', margin: [2,3,2,3] },
      td:  { fontSize: BODY_SIZE, margin: [2,2,2,2] },
    },
    defaultStyle: { font: 'DejaVu' },
  };
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  Handler
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  try { jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }

  try {
    const monthParam = req.query && req.query.month;

    if (monthParam) {
      // ââ Monthly PA mode âââââââââââââââââââââââââââââââââââââââââââââââââ
      const parts = String(monthParam).split('-').map(Number);
      const targetYear  = parts[0] || new Date().getFullYear();
      const targetMonth = parts[1] ? parts[1] - 1 : new Date().getMonth(); // 0-indexed

      const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthLabel = MONTH_NAMES[targetMonth] + ' ' + targetYear;
      const reportId   = 'PA-' + targetYear + '-' + String(targetMonth + 1).padStart(2,'0');

      const [archCsv, mepCsv] = await Promise.all([fetchText(ARCH_URL), fetchText(MEP_URL)]);
      const archPeople = archCsv ? parseArchMonthly(archCsv, targetYear, targetMonth) : [];
      const mepPeople  = mepCsv  ? parseMEPMonthly(mepCsv,  targetYear, targetMonth) : [];

      const docDef = buildMonthlyPdf(archPeople, mepPeople, monthLabel, reportId);
      const doc    = printer.createPdfKitDocument(docDef);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + reportId + '.pdf"');
      doc.pipe(res);
      doc.end();

    } else {
      // ââ Daily attendance mode (original) âââââââââââââââââââââââââââââââââ
      const [archCsv, mepCsv] = await Promise.all([fetchText(ARCH_URL), fetchText(MEP_URL)]);
      const archProjects = aggregatePeople(parseArch(archCsv));
      const mepProjects  = aggregatePeople(parseMEP(mepCsv));

      const docDef = buildDailyPdf(archProjects, mepProjects);
      const doc    = printer.createPdfKitDocument(docDef);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="attendance.pdf"');
      doc.pipe(res);
      doc.end();
    }

  } catch (err) {
    console.error('attendance error:', err);
    res.status(500).json({ error: err.message });
  }
};
