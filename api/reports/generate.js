const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { Client } = require('@notionhq/client');

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

function fetchProjects({ billingModelFilter, statusFilter, projectName } = {}) {
  const dataPath = path.join(process.cwd(), 'public', 'projects_data.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  let projects = data.projects.map(p => ({
    name:              p.name,
    code:              p.code,
    billingModel:      p.billing_model,
    status:            p.status,
    stage:             p.stage,
    progress:          p.progress,
    client:            p.client,
    location:          p.location,
    teamSize:          p.team_size,
    contractValue:     p.contract_value,
    manmonthsBudgeted: p.manmonths_budgeted,
    manmonthsUsed:     p.manmonths_used,
    totalFiles:        p.total_files,
    scopeDescription:  p.scope,
    disciplines:       p.disciplines || [],
    totalDrawings:     0,
    bepStatus:         '',
    midpStatus:        '',
    startDate:         '',
    plannedEnd:        '',
  }));

  if (billingModelFilter) projects = projects.filter(p => p.billingModel === billingModelFilter);
  if (statusFilter)       projects = projects.filter(p => p.status === statusFilter);
  if (projectName) {
    const q = projectName.toLowerCase();
    projects = projects.filter(p => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)));
  }

  return projects;
}

// Date helpers
function fmtISO(d) { return d.toISOString().slice(0, 10); }

function dateRangeArr(startDate, endDate) {
  const out = [];
  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate   + 'T00:00:00Z');
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) out.push(fmtISO(d));
  return out;
}

function dayHeaderLabel(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
  return mon + ' ' + d.getUTCDate() + ' ' + dow;
}

function rangeLabel(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate   + 'T00:00:00Z');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return mon[s.getUTCMonth()] + ' ' + s.getUTCDate() + ' – ' + mon[e.getUTCMonth()] + ' ' + e.getUTCDate() + ', ' + e.getUTCFullYear();
}

// KPI Report Generator
async function generateKpiReport({ reportType, startDate, endDate, decoded, res }) {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  // AUTO-DEFAULT: no dates -> last 3 complete days ending yesterday
  if (!startDate && !endDate) {
    const today = new Date();
    const yesterday    = new Date(today); yesterday.setDate(today.getDate() - 1);
    const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3);
    startDate = fmtISO(threeDaysAgo);
    endDate   = fmtISO(yesterday);
  }
  // Single-day: if only From is given, use same date for To
  if (startDate && !endDate) endDate = startDate;

  // Fetch all pages - NO server-side filter or sort (KPI DB is multi-source;
  // legacy databases.query cannot resolve property-based filters or sorts).
  // We pull everything and filter/sort in JS.
  const pages = [];
  let cursor;
  do {
    const resp = await notion.databases.query({
      database_id: process.env.NOTION_KPI_DB,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    });
    pages.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : null;
  } while (cursor);

  // Extract flat records
  // DB: "KPI Daily Log" (d1f96fc54b194fc38de01b8647263702)
  // Field names: Date (date), Staff Name (text), Project (select), KPI Type (select),
  //              KPI Value (number), Day Status (select), Package/Discipline (text),
  //              Manager (text), Coordinator (text), Updated At (text)
  let records = pages.map(page => {
    const p = page.properties;
    const txt = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || '';
    const sel = (prop) => prop?.select?.name || prop?.status?.name || '';
    return {
      date:              p['Date']?.date?.start || '',
      staffName:         txt(p['Staff Name'] || p['Name']),
      project:           sel(p['Project']),
      kpiType:           sel(p['KPI Type']),
      kpiValue:          p['KPI Value']?.number ?? null,
      dayStatus:         sel(p['Day Status']),
      packageDiscipline: txt(p['Package/Discipline']),
      manager:           txt(p['Manager']),
      coordinator:       txt(p['Coordinator'])
    };
  });

  // Filter by date range in JS
  if (startDate) records = records.filter(r => r.date && r.date >= startDate);
  if (endDate)   records = records.filter(r => r.date && r.date <= endDate);

  // Sort in JS
  records.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Per-staff summary (used by attendance/bench Claude prompts)
  const staffMap = {};
  for (const r of records) {
    const key = r.staffName + '||' + r.project;
    if (!staffMap[key]) {
      staffMap[key] = {
        staffName: r.staffName, project: r.project,
        manager: r.manager, coordinator: r.coordinator,
        packageDiscipline: r.packageDiscipline,
        presentDays: 0, holidayDays: 0, leaveDays: 0,
        modelKpi: [], sheetKpi: [], paramKpi: [], dates: new Set()
      };
    }
    const s = staffMap[key];
    if (r.date) s.dates.add(r.date);
    if (r.dayStatus === 'Present')  s.presentDays++;
    else if (r.dayStatus === 'Holiday') s.holidayDays++;
    else if (r.dayStatus === 'Leave')   s.leaveDays++;
    if (r.kpiValue !== null) {
      if (r.kpiType === 'Model KPI')       s.modelKpi.push(r.kpiValue);
      else if (r.kpiType === 'Sheet KPI')  s.sheetKpi.push(r.kpiValue);
      else if (r.kpiType === 'Parameter KPI') s.paramKpi.push(r.kpiValue);
    }
  }
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
  const staffSummary = Object.values(staffMap).map(s => ({
    staffName: s.staffName, project: s.project,
    manager: s.manager, coordinator: s.coordinator,
    packageDiscipline: s.packageDiscipline,
    totalDays: s.dates.size,
    presentDays: s.presentDays, holidayDays: s.holidayDays, leaveDays: s.leaveDays,
    avgModelKpi: avg(s.modelKpi), avgSheetKpi: avg(s.sheetKpi), avgParamKpi: avg(s.paramKpi)
  }));
  const projMap = {};
  for (const s of staffSummary) {
    if (!projMap[s.project]) projMap[s.project] = { project: s.project, staff: [] };
    projMap[s.project].staff.push(s);
  }

  const dateLabel = startDate && endDate
    ? (startDate + ' to ' + endDate)
    : startDate ? ('from ' + startDate) : 'All available data';

  const reportTitles = {
    kpi_report: 'KPI Report — Project Portfolio',
    daily_attendance_report: 'Daily Attendance Summary Report',
    bench_resource_report: 'Bench Resource Report'
  };

  // KPI_REPORT: pivoted per-day output (rich PDF-style)
  if (reportType === 'kpi_report' && startDate && endDate) {
    const days = dateRangeArr(startDate, endDate);

    // Build per-project, per-staff structure
    const projects = {};
    for (const r of records) {
      const projectKey = r.project || r.staffName || 'General';
      if (!r.project) r.project = projectKey;
      if (!projects[r.project]) projects[r.project] = {
        name: r.project, coordinator: '', manager: '', staff: {}
      };
      if (r.coordinator && !projects[r.project].coordinator) projects[r.project].coordinator = r.coordinator;
      if (r.manager     && !projects[r.project].manager)     projects[r.project].manager     = r.manager;
      if (!r.staffName) continue;
      const proj = projects[r.project];
      if (!proj.staff[r.staffName]) proj.staff[r.staffName] = {
        name: r.staffName, package: '', manager: '', byDate: {}, statusByDate: {}
      };
      const sref = proj.staff[r.staffName];
      if (!sref.package && r.packageDiscipline) sref.package = r.packageDiscipline;
      if (!sref.manager && r.manager)           sref.manager = r.manager;
      if (!sref.byDate[r.date]) sref.byDate[r.date] = {};
      if (r.kpiType && r.kpiValue !== null) sref.byDate[r.date][r.kpiType] = r.kpiValue;
      if (r.dayStatus) sref.statusByDate[r.date] = r.dayStatus;
    }

    const sortedProjects = Object.values(projects).sort((a, b) => a.name.localeCompare(b.name));
    const reportId = 'KPI-' + fmtISO(new Date());
    const rangeLbl = rangeLabel(startDate, endDate);
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const projectHolidayDays = {};
    for (const proj of sortedProjects) {
      projectHolidayDays[proj.name] = {};
      for (const d of days) {
        let isHol = false;
        for (const st of Object.values(proj.staff)) {
          if (st.statusByDate[d] === 'Holiday') { isHol = true; break; }
        }
        projectHolidayDays[proj.name][d] = isHol;
      }
    }

    const kpiCell = (staff, projName, date, type) => {
      const status = staff.statusByDate[date];
      const projIsHol = projectHolidayDays[projName]?.[date];
      if (status === 'Holiday' || projIsHol) return { text: 'Holiday', cls: 'holiday' };
      const dayRecords = staff.byDate[date];
      const hasAnyRecord = dayRecords && Object.keys(dayRecords).length > 0;
      if (!hasAnyRecord) return { text: 'Absent', cls: 'absent' };
      const val = dayRecords[type];
      if (val !== undefined && val !== null && val !== 0) return { text: String(val), cls: 'val' };
      if (val === 0) return { text: '0', cls: 'val' };
      return { text: '—', cls: 'empty' };
    };

    const coordCell = (proj, date) => {
      const projIsHol = projectHolidayDays[proj.name]?.[date];
      if (projIsHol) return { text: 'Holiday', cls: 'holiday' };
      let total = 0;
      for (const st of Object.values(proj.staff)) {
        const v = st.byDate[date]?.['Sheet KPI'];
        if (typeof v === 'number') total += v;
      }
      return { text: String(total), cls: 'val' };
    };

    const cellColor = (cls) =>
      cls === 'holiday' ? '#1e40af'
      : cls === 'absent' ? '#dc2626'
      : cls === 'val'    ? '#0f172a'
      : '#9ca3af';
    const cellWeight = (cls) => (cls === 'val' || cls === 'holiday' || cls === 'absent') ? '600' : '400';

    const coverProjects = sortedProjects.map((proj, i) => {
      return '' +
        '<div class="cover-card">' +
          '<div class="cover-card-num">' + (i + 1) + '</div>' +
          '<div class="cover-card-body">' +
            '<div class="cover-card-name">' + proj.name + '</div>' +
            '<div class="cover-card-meta">' +
              '<div class="cover-card-meta-col">' +
                '<div class="cover-card-meta-label">COORDINATOR</div>' +
                '<div class="cover-card-meta-val">' + (proj.coordinator || '—') + '</div>' +
              '</div>' +
              '<div class="cover-card-meta-col">' +
                '<div class="cover-card-meta-label">PROJECT MANAGER</div>' +
                '<div class="cover-card-meta-val">' + (proj.manager || '—') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    const coverRows = [];
    for (let i = 0; i < coverProjects.length; i += 2) {
      coverRows.push('<div class="cover-row">' + coverProjects[i] + (coverProjects[i+1] || '') + '</div>');
    }
    const coverPage =
      '<section class="cover">' +
        '<div class="cover-eyebrow">PROJECT PORTFOLIO</div>' +
        '<div class="cover-title">KPI Report</div>' +
        '<div class="cover-sub">Portfolio delivery performance · ' + sortedProjects.length + ' active projects</div>' +
        '<div class="cover-meta">' +
          '<div class="cover-meta-block">' +
            '<div class="cover-meta-label">REPORTING WINDOW</div>' +
            '<div class="cover-meta-val">' + rangeLbl + '</div>' +
            '<div class="cover-meta-sub">' + days.map(d => dayHeaderLabel(d).split(' ').slice(2).join(' ')).join(' · ') + '</div>' +
          '</div>' +
          '<div class="cover-meta-block">' +
            '<div class="cover-meta-label">ISSUE DATE</div>' +
            '<div class="cover-meta-val">' + issueDate + '</div>' +
            '<div class="cover-meta-sub">End-of-day snapshot</div>' +
          '</div>' +
        '</div>' +
        '<div class="cover-section-label">PROJECTS COVERED</div>' +
        '<div class="cover-section-sub">' + sortedProjects.length + ' projects · 1 portfolio</div>' +
        coverRows.join('') +
      '</section>';

    const sectionColors = {
      'Model KPI':     { bg: '#1e40af', txt: '#ffffff' },
      'Parameter KPI': { bg: '#6d28d9', txt: '#ffffff' },
      'Sheet KPI':     { bg: '#047857', txt: '#ffffff' },
    };
    const dayHeaders = days.map(d =>
      '<th class="th-day">' + dayHeaderLabel(d) + '</th>'
    ).join('');

    const projectKpiTypes = {};
    for (const proj of sortedProjects) {
      const types = new Set();
      for (const st of Object.values(proj.staff)) {
        for (const dayMap of Object.values(st.byDate || {})) {
          for (const t of Object.keys(dayMap)) types.add(t);
        }
      }
      projectKpiTypes[proj.name] = types;
    }

    const projectBlocks = sortedProjects.map((proj, idx) => {
      const staffList = Object.values(proj.staff).sort((a, b) => a.name.localeCompare(b.name));
      const availTypes = projectKpiTypes[proj.name];

      const pivotTable = (type) => {
        if (!availTypes.has(type)) return '';
        const sec = sectionColors[type];
        const typeStaffList = staffList.filter(st =>
          Object.values(st.byDate || {}).some(dayMap => type in dayMap)
        );
        const rows = typeStaffList.map(st => {
          const cells = days.map(d => {
            const c = kpiCell(st, proj.name, d, type);
            return '<td class="td-cell" style="color:' + cellColor(c.cls) + ';font-weight:' + cellWeight(c.cls) + '">' + c.text + '</td>';
          }).join('');
          const pkgMan = (st.package || '—') + (st.manager ? ' / ' + st.manager : '');
          return '<tr>' +
            '<td class="td-name">' + st.name + '</td>' +
            '<td class="td-pkg">' + pkgMan + '</td>' +
            cells +
          '</tr>';
        }).join('');
        const emptyRow = '<tr><td colspan="' + (2 + days.length) + '" class="td-empty">No staff records</td></tr>';
        return '' +
          '<div class="kpi-section-bar" style="background:' + sec.bg + ';color:' + sec.txt + '">' +
            '<span class="kpi-section-bullet"></span>' + type +
          '</div>' +
          '<table class="kpi-table">' +
            '<thead><tr>' +
              '<th class="th-name">Name</th>' +
              '<th class="th-pkg">Package / Manager</th>' +
              dayHeaders +
            '</tr></thead>' +
            '<tbody>' + (rows || emptyRow) + '</tbody>' +
          '</table>';
      };

      const coordRow = days.map(d => {
        const c = coordCell(proj, d);
        return '<td class="coord-cell" style="color:' + cellColor(c.cls) + '">' + c.text + '</td>';
      }).join('');

      return '' +
        '<section class="project-block">' +
          '<div class="project-title">' + (idx + 1) + '. ' + proj.name + '</div>' +
          '<table class="coord-table">' +
            '<tr>' +
              '<td class="coord-name">' + (proj.coordinator || '—') + '</td>' +
              '<td class="coord-label">Coordinator</td>' +
              coordRow +
            '</tr>' +
          '</table>' +
          pivotTable('Model KPI') +
          pivotTable('Parameter KPI') +
          pivotTable('Sheet KPI') +
        '</section>';
    }).join('');

    const emptyMsg = '<div class="empty-msg">No KPI records for ' + rangeLbl + '</div>';

    const styles = `
      <style>
        @page { size: A4; margin: 18mm 14mm 22mm 14mm; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#0f172a; font-size:9.5pt; line-height:1.4; margin:0; padding:0; }
        .page-header { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #e5e7eb; font-size:8pt; color:#64748b; letter-spacing:0.04em; text-transform:uppercase; }
        .page-header .right { font-weight:600; color:#1e40af; }
        .cover { padding:8px 4px 0; }
        .cover-eyebrow { color:#64748b; font-size:9pt; letter-spacing:0.18em; font-weight:700; margin-top:18px; }
        .cover-title { font-size:32pt; font-weight:800; color:#1e40af; margin:8px 0 4px; line-height:1.1; }
        .cover-sub { font-size:11pt; color:#475569; margin-bottom:24px; }
        .cover-meta { display:flex; gap:24px; padding:14px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:24px; }
        .cover-meta-block { flex:1; }
        .cover-meta-label { font-size:8pt; letter-spacing:0.12em; color:#64748b; font-weight:700; }
        .cover-meta-val { font-size:13pt; color:#1e40af; font-weight:700; margin-top:4px; }
        .cover-meta-sub { font-size:9pt; color:#64748b; margin-top:2px; }
        .cover-section-label { font-size:9pt; letter-spacing:0.12em; color:#1e40af; font-weight:700; margin-top:18px; }
        .cover-section-sub { font-size:9pt; color:#64748b; margin-bottom:14px; }
        .cover-row { display:flex; gap:12px; margin-bottom:10px; }
        .cover-card { flex:1; border:1px solid #e2e8f0; border-radius:6px; padding:12px 14px; display:flex; align-items:center; gap:14px; background:#ffffff; }
        .cover-card-num { font-size:18pt; color:#1e40af; font-weight:800; min-width:24px; }
        .cover-card-body { flex:1; }
        .cover-card-name { font-size:11pt; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .cover-card-meta { display:flex; gap:16px; font-size:8pt; }
        .cover-card-meta-col { flex:1; }
        .cover-card-meta-label { color:#64748b; letter-spacing:0.08em; font-weight:600; font-size:7.5pt; }
        .cover-card-meta-val { color:#0f172a; font-weight:600; font-size:9.5pt; margin-top:2px; }
        .page-break { page-break-before: always; }
        .project-block { margin-bottom:18px; page-break-inside: avoid; }
        .project-title { font-size:13pt; font-weight:800; color:#1e40af; margin:10px 0 8px; }
        .coord-table { width:100%; border-collapse:collapse; background:#f8fafc; margin-bottom:6px; border:1px solid #e2e8f0; }
        .coord-table td { padding:8px 10px; font-size:9.5pt; }
        .coord-name { font-weight:700; color:#0f172a; width:24%; }
        .coord-label { color:#64748b; width:20%; }
        .coord-cell { text-align:center; font-weight:700; }
        .kpi-section-bar { padding:6px 12px; font-size:9.5pt; font-weight:700; margin-top:8px; display:flex; align-items:center; }
        .kpi-section-bullet { display:inline-block; width:8px; height:8px; background:rgba(255,255,255,0.95); margin-right:8px; }
        .kpi-table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:4px; }
        .kpi-table thead tr { background:#f1f5f9; }
        .kpi-table th { padding:6px 8px; text-align:left; color:#475569; font-weight:700; border-bottom:1px solid #e2e8f0; font-size:8pt; }
        .th-day { text-align:center; }
        .kpi-table tbody tr:nth-child(even) { background:#f8fafc; }
        .td-name { padding:5px 8px; font-weight:600; color:#0f172a; }
        .td-pkg { padding:5px 8px; color:#64748b; }
        .td-cell { padding:5px 8px; text-align:center; }
        .td-empty { padding:10px; text-align:center; color:#9ca3af; }
        .empty-msg { padding:20px; text-align:center; color:#9ca3af; }
      </style>
    `;

    const html = '' +
      '<div class="kpi-report-root">' +
        styles +
        '<div class="page-header">' +
          '<div>CONFIDENTIAL · INTERNAL DISTRIBUTION</div>' +
          '<div class="right">Report ID · ' + reportId + '</div>' +
        '</div>' +
        coverPage +
        (sortedProjects.length ? '<div class="page-break"></div>' : '') +
        (projectBlocks || emptyMsg) +
      '</div>';

    const mdLines = [
      '# KPI Report — Project Portfolio',
      '**Period:** ' + rangeLbl + '  |  **Report ID:** ' + reportId + '  |  **Generated by:** ' + decoded.email,
      ''
    ];
    sortedProjects.forEach((proj, idx) => {
      const staffList = Object.values(proj.staff).sort((a, b) => a.name.localeCompare(b.name));
      mdLines.push('## ' + (idx + 1) + '. ' + proj.name);
      mdLines.push('**Coordinator:** ' + (proj.coordinator || '—') + '  |  **Project Manager:** ' + (proj.manager || '—'));
      mdLines.push('');
      for (const type of ['Model KPI', 'Parameter KPI', 'Sheet KPI']) {
        mdLines.push('### ' + type);
        mdLines.push('| Name | Package / Manager | ' + days.map(dayHeaderLabel).join(' | ') + ' |');
        mdLines.push('|------|---------|' + days.map(() => '------').join('|') + '|');
        for (const st of staffList) {
          const cells = days.map(d => kpiCell(st, proj.name, d, type).text);
          const pkgMan = (st.package || '—') + (st.manager ? ' / ' + st.manager : '');
          mdLines.push('| ' + st.name + ' | ' + pkgMan + ' | ' + cells.join(' | ') + ' |');
        }
        mdLines.push('');
      }
    });
    mdLines.push('*Auto-generated from JES BIM KPI Tracking DB | JES BIM AI*');
    const markdown = mdLines.join('\n');

    return res.status(200).json({
      success: true,
      report: {
        title: reportTitles.kpi_report + ' — ' + rangeLbl,
        subtitle: records.length + ' records across ' + sortedProjects.length + ' projects · ' + reportId,
        kind: 'lump-sum',
        reportLabel: 'KPI Report',
        content: markdown,
        html: html,
        generatedAt: new Date().toISOString(),
        generatedBy: decoded.email,
        projectCount: sortedProjects.length,
        type: reportType,
        filters: { startDate: startDate, endDate: endDate },
      }
    });
  }

  // Non-kpi_report: attendance / bench - still use Claude markdown path
  const reportPrompts = {
    daily_attendance_report: 'Generate a professional JES BIM Daily Attendance Summary in markdown.\n\n' +
      '## DATE RANGE: ' + dateLabel + '\n' +
      '## TOTAL RECORDS: ' + records.length + '\n\n' +
      '## ATTENDANCE DATA:\n' +
      JSON.stringify(staffSummary, null, 2) + '\n\n' +
      '# JES BIM — Daily Attendance Summary Report\n' +
      '**Period:** ' + dateLabel + ' | **Generated:** ' + new Date().toLocaleDateString('en-GB') + ' | **By:** ' + decoded.email + '\n\n' +
      '## Attendance Overview\n[Total staff, present days, leave days, holiday days across all projects]\n\n' +
      '## Per-Project Attendance Table\n[Table: Project | Staff Count | Avg Present Days | Leave Days | Holiday Days | Attendance %]\n\n' +
      '## Per-Staff Detail\n[Table: Staff | Project | Package | Present | Leave | Holiday | Total Days]\n\n' +
      '## Observations\n[Notable patterns or issues]\n\n' +
      '*Auto-generated from JES BIM KPI Tracking DB | JES BIM AI*',

    bench_resource_report: 'Generate a JES BIM Bench Resource Report in markdown.\n\n' +
      '## DATE RANGE: ' + dateLabel + '\n' +
      '## STAFF DATA:\n' +
      JSON.stringify(staffSummary, null, 2) + '\n\n' +
      '# JES BIM — Bench Resource Report\n' +
      '**Period:** ' + dateLabel + ' | **Generated:** ' + new Date().toLocaleDateString('en-GB') + ' | **By:** ' + decoded.email + '\n\n' +
      '## Summary\n[Total staff tracked, projects covered]\n\n' +
      '## Resource Availability\n[Based on attendance data, identify staff with low utilization or bench status]\n\n' +
      '## Staff by Project\n[Table: Staff | Project | Package | Present Days | Utilization %]\n\n' +
      '## Recommendations\n[Resource redeployment suggestions]\n\n' +
      '*Auto-generated from JES BIM KPI Tracking DB | JES BIM AI*'
  };

  const prompt = reportPrompts[reportType] || reportPrompts.daily_attendance_report;

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.json();
    throw new Error(err.error?.message || 'Claude API failed');
  }

  const claudeData = await claudeRes.json();
  const reportContent = claudeData.content[0].text;

  return res.status(200).json({
    success: true,
    report: {
      title: (reportTitles[reportType] || 'KPI Report') + ' — ' + dateLabel,
      subtitle: records.length + ' records across ' + Object.keys(projMap).length + ' projects',
      kind: 'lump-sum',
      reportLabel: reportTitles[reportType] || 'KPI Report',
      content: reportContent,
      generatedAt: new Date().toISOString(),
      generatedBy: decoded.email,
      projectCount: Object.keys(projMap).length,
      type: reportType,
      filters: { startDate: startDate, endDate: endDate }
    }
  });
}


// ============================================================
// IPA Report Generator — AFE Style & AlTayer Style
// Returns templateId + templateData so the frontend calls
// /api/reports/master for the structured pdfmake PDF.
// ============================================================
async function generateIpaReport({ reportType, projectName, decoded, res }) {
  // Find the project
  const projects = fetchProjects({ projectName });
  if (projects.length === 0) {
    return res.status(200).json({
      success: true,
      report: {
        title: 'Project Not Found',
        content: 'No project found matching "' + (projectName || '—') + '". Please select a project and try again.',
        generatedAt: new Date().toISOString(),
        projectCount: 0,
        type: reportType,
      }
    });
  }

  const p = projects[0];
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const ipaNo = 'IPA-' + (p.code || p.name.replace(/\s+/g, '').slice(0, 4).toUpperCase()) +
                '-' + String(today.getFullYear()).slice(2) +
                String(today.getMonth() + 1).padStart(2, '0');
  const cv = Number(p.contractValue) || 0;

  let templateData;

  if (reportType === 'ipa_afe') {
    // ── AFE Style: MEP + Architectural breakdown ─────────────────────────────
    // Split contract value: 55% MEP, 40% Arch, 5% On-Site Co-ord (typical)
    const mepCV  = cv * 0.55;
    const archCV = cv * 0.40;
    const coordCV = cv * 0.05;

    // MEP sub-items (weights add to 100% of mepCV)
    const mepWeights = [0.10, 0.25, 0.20, 0.30, 0.10, 0.05];
    const mepNames   = ['Design', 'Shop Drawings', 'Material Delivery', 'On-Site Installation', 'Testing & Commissioning', 'As-built / Documentation'];
    const archWeights = [0.10, 0.30, 0.15, 0.30, 0.10, 0.05];
    const archNames   = ['Design', 'Shop Drawings', 'Material Delivery', 'On-Site Installation', 'Testing & Commissioning', 'As-built / Documentation'];

    templateData = {
      ipa: {
        no:            ipaNo,
        date:          todayStr,
        client:        p.client  || '',
        project:       p.name    || '',
        contractValue: cv || null,
        preparedBy: { nameRole: decoded.name || decoded.email || 'JES BIM', date: todayStr },
        approvedBy:  {},
      },
      itemA: {
        label: 'MEP Works',
        components: mepNames.map((name, i) => ({
          name,
          contractValue: mepCV * mepWeights[i],
          cumPrev: 0,
          thisApp: 0,
        })),
      },
      itemB: {
        label: 'Architectural Works',
        components: archNames.map((name, i) => ({
          name,
          contractValue: archCV * archWeights[i],
          cumPrev: 0,
          thisApp: 0,
        })),
      },
      itemC: {
        label: 'On-Site Co-ordinator',
        contractValue: coordCV,
        cumPrev: 0,
        thisApp: 0,
      },
      deductions: {
        certifiedAdvance: 0,
        retention: null,      // auto-calculated as 5% in template
        retentionReleased: 0,
        other: 0,
      },
      amountInWords: '',
    };

  } else {
    // ── AlTayer Style: Completion % × Contract Value ──────────────────────────
    const completionPct = Number(p.progress) || 0;
    const advancePct    = 10; // default 10% — user can adjust before signing

    templateData = {
      ipa: {
        no:            ipaNo,
        date:          todayStr,
        client:        p.client  || '',
        project:       p.name    || '',
        contractValue: cv || null,
        advancePct,
        preparedBy: { nameRole: decoded.name || decoded.email || 'JES BIM', date: todayStr },
        approvedBy:  {},
      },
      itemA: { label: 'Project Completion', completionPct },
      itemB: { label: 'On-Site Co-ordinator', amount: 0 },
      itemC: { label: 'Additional Scope',     amount: 0 },
      deductions: {
        advancePct,
        retention: null,
        retentionReleased: 0,
        other: 0,
      },
      amountInWords: '',
    };
  }

  const templateTitle = reportType === 'ipa_afe'
    ? 'Interim Payment Application — AFE Style'
    : 'Interim Payment Application — AlTayer Style';

  return res.status(200).json({
    success: true,
    report: {
      title:        templateTitle + ' — ' + p.name,
      subtitle:     'Project: ' + p.name + ' | Client: ' + (p.client || '—') + ' | Contract: AED ' + (cv ? cv.toLocaleString() : '—'),
      templateId:   reportType,          // 'ipa_afe' or 'ipa_altayer'
      templateData,                      // passed to /api/reports/master
      kind:         'lump-sum',
      reportLabel:  'IPA',
      generatedAt:  new Date().toISOString(),
      generatedBy:  decoded.email,
      projectCount: 1,
      type:         reportType,
      content:      '**' + templateTitle + '** generated for **' + p.name + '**\n\n' +
                    '- Client: ' + (p.client || '—') + '\n' +
                    '- Contract Value: AED ' + (cv ? cv.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—') + '\n' +
                    '- IPA Reference: ' + ipaNo + '\n' +
                    '- Date: ' + todayStr + '\n\n' +
                    '> Click **Download PDF** below to generate the structured IPA document.',
    }
  });
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
    const { reportType = 'status', billingModelFilter, projectFilter, projectName, startDate, endDate } = req.body;

    const standaloneTypes = ['kpi_report', 'daily_attendance_report', 'bench_resource_report'];
    if (standaloneTypes.includes(reportType)) {
      return await generateKpiReport({ reportType, startDate, endDate, decoded, res });
    }

    // ── IPA Report Types → structured pdfmake template ─────────────────────
    const ipaTypes = ['ipa_afe', 'ipa_altayer'];
    if (ipaTypes.includes(reportType)) {
      return await generateIpaReport({ reportType, projectName, decoded, res });
    }

    const allProjects = fetchProjects({ billingModelFilter });
    const availableNames = allProjects.map(p => p.name).join(', ');

    let projects = allProjects;
    if (projectName) {
      const q = projectName.toLowerCase();
      projects = allProjects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q))
      );
      if (projects.length === 0) {
        return res.status(200).json({
          success: true,
          report: {
            title: 'Project Not Found',
            content: 'No project found matching **"' + projectName + '"**.\n\n**Available projects:**\n' + allProjects.map(p => '- ' + p.name + (p.code ? ' (' + p.code + ')' : '')).join('\n') + '\n\nPlease try one of the names above.',
            generatedAt: new Date().toISOString(),
            projectCount: 0
          }
        });
      }
    }

    if (projects.length === 0) {
      return res.status(200).json({
        success: true,
        report: {
          title: 'No Data Found',
          content: 'No projects match the selected filters.\n\n**Available projects:** ' + availableNames,
          generatedAt: new Date().toISOString(),
          projectCount: 0
        }
      });
    }

    const active     = projects.filter(p => p.status === 'Active');
    const lumpSum    = projects.filter(p => p.billingModel === 'Lump Sum');
    const resourcing = projects.filter(p => p.billingModel === 'Resourcing');
    const totalMM_B  = projects.reduce((s, p) => s + (p.manmonthsBudgeted || 0), 0);
    const totalMM_U  = projects.reduce((s, p) => s + (p.manmonthsUsed     || 0), 0);

    const reportPrompt = 'Generate a professional JES BIM Operations Report in markdown.\n\n' +
      '## FILTERS APPLIED:\n' +
      '- Report Type: ' + reportType + '\n' +
      '- Billing Filter: ' + (billingModelFilter || 'All') + '\n' +
      '- Status Filter: ' + (projectFilter || 'All') + '\n' +
      '- Project Filter: ' + (projectName || 'All') + '\n' +
      '- Date: ' + new Date().toISOString().split('T')[0] + '\n\n' +
      '## PORTFOLIO SUMMARY:\n' +
      '- Total Projects: ' + projects.length + '\n' +
      '- Active: ' + active.length + ' | Lump Sum: ' + lumpSum.length + ' | Resourcing: ' + resourcing.length + '\n' +
      '- Total MM Budgeted: ' + totalMM_B + ' | Total MM Used: ' + totalMM_U + ' | Utilisation: ' + (totalMM_B ? Math.round((totalMM_U/totalMM_B)*100) : 0) + '%\n' +
      '- Avg Progress (Active): ' + (active.length ? Math.round(active.reduce((s,p)=>s+p.progress,0)/active.length) : 0) + '%\n' +
      '- Total Team: ' + active.reduce((s,p)=>s+p.teamSize,0) + '\n\n' +
      '## PROJECT DATA:\n' +
      JSON.stringify(projects, null, 2) + '\n\n' +
      'Generate a concise ' + reportType + ' report with these sections:\n\n' +
      '# JES BIM — ' + reportType.toUpperCase() + ' Report\n' +
      '**Date:** ' + new Date().toLocaleDateString('en-GB') + ' | **By:** ' + decoded.email + '\n\n' +
      '## Executive Summary\n[3 bullet key takeaways]\n\n' +
      '## Project Overview\n[Table: Project | Type | Status | Progress% | MM Used/Budget | MM% | Flag]\n\n' +
      '## Key Risks\n[Top 3 risks with project name and action]\n\n' +
      '## Recommendations\n[3 actionable items]\n\n' +
      'Be concise. Use only real data from the project list above.\n' +
      '*Auto-generated from MASTER REGISTERS | JES BIM AI*';

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: reportPrompt }]
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json();
      throw new Error(err.error?.message || 'Failed to generate report');
    }

    const claudeData = await claudeRes.json();
    const reportContent = claudeData.content[0].text;

    const reportMeta = {
      'status':    { title: 'Monthly Progress Report',    subtitle: 'Project status, milestones, deliverables & risks', kind: 'lump-sum',  label: 'Progress Report' },
      'progress':  { title: 'Monthly Progress Report',    subtitle: 'Project status, milestones, deliverables & risks', kind: 'lump-sum',  label: 'Progress Report' },
      'kpi':       { title: 'KPI Dashboard Report',       subtitle: 'Operational KPIs with trends and insights',        kind: 'lump-sum',  label: 'KPI Dashboard' },
      'manmonth':  { title: 'Manmonth Efficiency Report', subtitle: 'Planned vs Actual hours, utilization and productivity', kind: 'lump-sum', label: 'Manmonth Report' },
      'portfolio': { title: 'Portfolio Billing Summary',  subtitle: 'Multi-project billing roll-up for leadership review', kind: 'lump-sum', label: 'Portfolio Summary' },
      'all':       { title: 'Full Operations Report',     subtitle: 'Portfolio-wide operational overview',              kind: 'lump-sum',  label: 'Portfolio Summary' },
    };
    const meta = reportMeta[reportType] || reportMeta['status'];
    const kind = billingModelFilter === 'Resourcing' ? 'resourcing' : meta.kind;
    const reportLabel = billingModelFilter === 'Resourcing'
      ? (meta.label === 'Portfolio Summary' ? 'Portfolio Resourcing Summary' : meta.label)
      : meta.label;

    return res.status(200).json({
      success: true,
      report: {
        title: meta.title + ' — ' + new Date().toLocaleDateString('en-GB'),
        subtitle: meta.subtitle,
        kind: kind,
        reportLabel: reportLabel,
        content: reportContent,
        generatedAt: new Date().toISOString(),
        generatedBy: decoded.email,
        projectCount: projects.length,
        type: reportType,
        filters: { billingModelFilter: billingModelFilter, projectFilter: projectFilter, projectName: projectName }
      }
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
};
