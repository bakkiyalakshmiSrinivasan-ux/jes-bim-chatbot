/**
 * v2 Report HTML templates.
 *
 * Each function takes the relevant Notion data slice and returns a complete
 * <html>...</html> string ready for puppeteer → PDF.
 *
 * Used by api/reports/v2-template.js
 */

// ── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif;
         color: #1f2937; font-size: 10pt; line-height: 1.4; }
  h1 { font-size: 22pt; color: #1F3B5B; margin: 0 0 4px 0; }
  h2 { font-size: 14pt; color: #3F73B6; margin: 14px 0 6px 0; text-transform: uppercase;
       letter-spacing: 0.5px; padding-top: 8px; border-top: 1px solid #E5EAF0; }
  h3 { font-size: 11pt; color: #1F3B5B; margin: 10px 0 4px 0; }
  p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9pt; }
  table th, table td { padding: 6px 8px; border: 1px solid #CCD3DB; text-align: left;
                       vertical-align: middle; }
  table th { background: #1F3B5B; color: #fff; font-weight: 600; font-size: 9pt;
             text-align: center; }
  table tbody tr:nth-child(even) { background: #FAFBFC; }
  table.kv th, table.kv td { background: #E5EAF0; color: #1F3B5B; font-weight: bold; width: 22%; }
  table.kv td:nth-child(even) { background: #fff; color: #1f2937; font-weight: normal; }
  .divider { height: 2px; background: #E97D2C; margin: 6px 0 12px; }
  .meta { color: #6B7785; font-size: 9pt; }
  .kpi-row { display: table; width: 100%; margin: 8px 0; }
  .kpi-card { display: table-cell; width: 25%; padding: 8px; text-align: center;
              background: #F5F7FA; border-top: 3px solid #1F3B5B; vertical-align: middle;
              border-right: 4px solid #fff; }
  .kpi-value { font-size: 18pt; font-weight: bold; color: #1F3B5B; }
  .kpi-label { font-size: 8pt; color: #6B7785; text-transform: uppercase;
               letter-spacing: 0.5px; margin-top: 2px; }
  .green { color: #2E8B57; }
  .red { color: #D9534F; }
  .orange { color: #E97D2C; }
  .navy { color: #1F3B5B; }
  .footer { color: #6B7785; font-size: 8pt; text-align: center; margin-top: 14px;
            border-top: 1px solid #E5EAF0; padding-top: 6px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px;
           font-size: 8pt; font-weight: bold; }
  .badge-green { background: #D4EDDA; color: #155724; }
  .badge-red { background: #F8D7DA; color: #721C24; }
  .badge-orange { background: #FFE5B4; color: #8B5A00; }
  .badge-blue { background: #D1ECF1; color: #0C5460; }
  .header-band { background: #1F3B5B; color: #fff; padding: 12px 14px;
                 margin: -14mm -14mm 14px -14mm; display: table; width: calc(100% + 28mm); }
  .header-band-left { display: table-cell; vertical-align: middle; }
  .header-band-right { display: table-cell; vertical-align: middle; text-align: right;
                        font-size: 9pt; color: #A0BACA; }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = {
  aed: (n) => n != null ? `AED ${Number(n).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '—',
  num: (n, dp = 1) => n != null ? Number(n).toFixed(dp) : '—',
  pct: (n) => n != null ? `${(Number(n) * 100).toFixed(2)}%` : '—',
  date: (s) => s ? new Date(s).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : '—',
  short: (s, n = 60) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—',
  esc: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
};

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  let cls = 'badge-blue';
  if (s.includes('completed') || s.includes('achieved') || s.includes('approved') || s.includes('paid'))
    cls = 'badge-green';
  else if (s.includes('overrun') || s.includes('rejected') || s.includes('delayed') || s.includes('open') || s.includes('risk'))
    cls = 'badge-red';
  else if (s.includes('progress') || s.includes('current') || s.includes('submitted'))
    cls = 'badge-orange';
  return `<span class="badge ${cls}">${fmt.esc(status || '—')}</span>`;
}

function kpiCard(value, label, color = 'navy') {
  return `<div class="kpi-card"><div class="kpi-value ${color}">${value}</div><div class="kpi-label">${label}</div></div>`;
}

function kvTable(rows, twoCol = true) {
  const cells = rows.map(r => {
    if (twoCol && r.length === 4) return `<tr><th>${fmt.esc(r[0])}</th><td>${r[1] ?? ''}</td><th>${fmt.esc(r[2])}</th><td>${r[3] ?? ''}</td></tr>`;
    return `<tr><th>${fmt.esc(r[0])}</th><td colspan="3">${r[1] ?? ''}</td></tr>`;
  }).join('');
  return `<table class="kv"><tbody>${cells}</tbody></table>`;
}

function dataTable(headers, rows, statusColIdx = -1) {
  const ths = headers.map(h => `<th>${fmt.esc(h)}</th>`).join('');
  const trs = rows.map(row => {
    const tds = row.map((cell, i) => {
      if (i === statusColIdx) return `<td>${statusBadge(cell)}</td>`;
      return `<td>${cell == null ? '—' : fmt.esc(String(cell))}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Page wrapper ─────────────────────────────────────────────────────────────
function htmlDoc(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fmt.esc(title)}</title>
    <style>${BASE_CSS}</style></head><body>${body}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MONTHLY PROGRESS REPORT
// ─────────────────────────────────────────────────────────────────────────────
function monthlyProgressHtml(data) {
  const { project, schedule = [], deliverables = [], commercial = [], issues = [], comms = [], manmonths = [] } = data;
  const today = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});

  // Aggregate counts
  const drawingTotal = deliverables.length;
  const submitted = deliverables.filter(d => /submitted|approved/i.test(d.status || '')).length;
  const approved = deliverables.filter(d => /^approved/i.test(d.status || '')).length;
  const underReview = deliverables.filter(d => /review|submitted/i.test(d.status || '')).length;

  // Group deliverables by discipline
  const byDisc = {};
  deliverables.forEach(d => {
    const key = d.discipline || 'Unspecified';
    byDisc[key] = byDisc[key] || { total:0, sub:0, app:0, rev:0 };
    byDisc[key].total++;
    if (/submitted|approved/i.test(d.status||'')) byDisc[key].sub++;
    if (/^approved/i.test(d.status||'')) byDisc[key].app++;
    if (/review/i.test(d.status||'')) byDisc[key].rev++;
  });
  const discRows = Object.entries(byDisc).map(([disc, c]) => [disc, c.total, c.sub, c.app, c.rev]);

  // Issues by type
  const byIssue = {};
  issues.forEach(i => {
    const key = `${i.type || 'Issue'} | ${i.discipline || '—'}`;
    byIssue[key] = byIssue[key] || { count:0, status: i.status || 'Open' };
    byIssue[key].count++;
  });
  const issueRows = Object.entries(byIssue).map(([k, v]) => {
    const [type, disc] = k.split(' | ');
    return [type, disc, v.count, v.status];
  });

  // MM totals
  const mmTotal = manmonths.reduce((s, m) => s + (m.consumedMM || 0), 0);
  const mmBudget = manmonths.reduce((s, m) => s + (m.budgetedMM || 0), 0);
  const mmUtil = mmBudget > 0 ? (mmTotal / mmBudget * 100).toFixed(1) + '%' : '—';

  // Commercial totals
  const claimedYTD = commercial.filter(c => /approved|paid/i.test(c.status||'')).reduce((s, c) => s + (c.amount || 0), 0);

  const body = `
    <p class="meta"><i>Joseph Engineering Services</i></p>
    <h1>MONTHLY PROGRESS REPORT</h1>
    <div class="divider"></div>

    <h2>1. Project Overview</h2>
    ${kvTable([
      ['Project Name', fmt.esc(project.name), 'Project Code', fmt.esc(project.code || '—')],
      ['Client', fmt.esc(project.client || '—'), 'Contractor', fmt.esc(project.contractor || '—')],
      ['Location', fmt.esc(project.location || '—'), 'Contract Value', fmt.aed(project.contractValue)],
      ['Scope', fmt.esc(project.scope || '—'), 'Disciplines', fmt.esc((project.disciplines || []).join(', '))],
      ['Start Date', fmt.date(project.startDate), 'Planned End', fmt.date(project.plannedEnd)],
      ['Current Stage', fmt.esc(project.stage || '—'), 'Status', fmt.esc(project.status || '—')],
      ['BEP Status', fmt.esc(project.bepStatus || '—'), 'MIDP Status', fmt.esc(project.midpStatus || '—')],
      ['Team Size', String(project.teamSize || '—'), 'Zone Structure', fmt.esc(project.zoneStructure || '—')],
      ['Consultant', fmt.esc(project.consultant || '—'), 'LPO Number', fmt.esc(project.lpoNumber || '—')],
    ])}

    <div class="kpi-row">
      ${kpiCard(fmt.pct(project.progress), 'Overall Progress', 'green')}
      ${kpiCard(String(drawingTotal), 'Total Drawings', 'navy')}
      ${kpiCard(`${schedule.filter(s=>/(achieved|completed)/i.test(s.status||'')).length}/${schedule.length}`, 'Milestones', 'orange')}
      ${kpiCard(String(issues.filter(i=>!/closed|resolved/i.test(i.status||'')).length), 'Active Issues', 'red')}
    </div>

    <h2>Drawing Progress</h2>
    ${dataTable(['Discipline', 'Total', 'Submitted', 'Approved', 'Under Review'], discRows.length ? discRows : [['—','—','—','—','—']])}

    <h2>Milestone Status</h2>
    ${dataTable(['Milestone', 'Phase', 'Planned %', 'Actual %', 'Status'],
      schedule.length ? schedule.map(m => [
        fmt.esc(m.milestone || '—'),
        fmt.esc(m.phase || '—'),
        fmt.pct(m.plannedPct),
        fmt.pct(m.actualPct),
        m.status || '—',
      ]) : [['—','—','—','—','—']],
      4)}

    <h2>Financial Overview</h2>
    ${dataTable(['Invoice / Claim', 'Type', 'Status', 'Amount (AED)', 'Issue Date'],
      commercial.length ? commercial.slice(0, 12).map(c => [
        fmt.esc(c.invoiceNo || '—'),
        fmt.esc(c.type || 'PA Claim'),
        c.status || '—',
        fmt.aed(c.amount).replace('AED ', ''),
        fmt.date(c.issuedDate),
      ]) : [['—','—','—','—','—']],
      2)}

    <h2>Issues & Clashes</h2>
    ${dataTable(['Type', 'Discipline', 'Count', 'Status'],
      issueRows.length ? issueRows : [['—','—','—','—']],
      3)}

    <h2>Communications Summary (Last 7)</h2>
    ${dataTable(['Date', 'Type', 'Subject', 'Status'],
      comms.length ? comms.slice(0, 7).map(c => [
        fmt.date(c.date), fmt.esc(c.type || '—'), fmt.short(c.subject || c.ref, 60), c.status || '—',
      ]) : [['—','—','—','—']],
      3)}

    <h2>Manmonth Consumption</h2>
    ${dataTable(['Period / Stream', 'Budgeted MM', 'Consumed MM', 'Utilization %', 'Health'],
      manmonths.length ? manmonths.slice(-6).map(m => [
        fmt.date(m.month) || fmt.esc(m.employee || '—'),
        fmt.num(m.budgetedMM),
        fmt.num(m.consumedMM),
        m.budgetedMM > 0 ? `${(m.consumedMM / m.budgetedMM * 100).toFixed(1)}%` : '—',
        m.health || '—',
      ]).concat([['TOTAL', fmt.num(mmBudget), fmt.num(mmTotal), mmUtil, '']]) : [['—','—','—','—','—']],
      4)}

    <div class="footer">
      Generated from JES BIM Operations v2 SSOT Hub | Plugin: Monthly Progress Report |
      Sources: DB-A, DB-1, DB-2, DB-3, DB-4, DB-5, DB-8, DB-9 | ${today}
    </div>
  `;
  return htmlDoc(`${project.name} — Monthly Progress`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMPLOYEE KPI REPORT
// ─────────────────────────────────────────────────────────────────────────────
function employeeKpiHtml(data) {
  const { project, manmonths = [], team = [] } = data;
  const today = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});

  // Find latest snapshot
  const monthly = manmonths.filter(m => m.month).sort((a, b) => (a.month || '').localeCompare(b.month || ''));
  const latest = monthly[monthly.length - 1] || {};
  const totalBudget = latest.budgetedMM || project.manmonthsBudgeted || 0;
  const consumed = latest.cumulativeConsumed || project.manmonthsUsed || 0;
  const remaining = totalBudget - consumed;
  const ei = consumed > 0 ? ((latest.actualPct || 0) / (consumed / totalBudget)).toFixed(2) : '—';

  // Role distribution
  const roleCount = {};
  team.forEach(p => {
    const r = p.designation || 'Other';
    roleCount[r] = (roleCount[r] || 0) + 1;
  });
  const totalRoles = Object.values(roleCount).reduce((s, c) => s + c, 0) || 1;
  const roleRows = Object.entries(roleCount).map(([role, count]) =>
    [role, count, ((count / totalRoles) * 100).toFixed(1) + '%']);

  const body = `
    <div class="header-band">
      <div class="header-band-left"><b>JES BIM OPERATIONS</b><br/>
        <span style="font-size:8pt;color:#A0BACA">Single Source of Truth (SSOT) Hub</span></div>
      <div class="header-band-right">
        ${fmt.num(totalBudget)} MM Budget | ${fmt.num(consumed)} MM Consumed | ${fmt.num(remaining)} MM Remaining
      </div>
    </div>

    <h1 style="text-align:center">Employee KPI Report</h1>
    <h3 style="color:#2C8E8C">${fmt.esc(project.name)}</h3>
    <p class="meta">${fmt.esc(project.scope || '—')} | ${fmt.esc((project.disciplines||[]).join(', '))} | Generated ${today}</p>
    <div class="divider"></div>

    <div class="kpi-row">
      ${kpiCard(fmt.num(totalBudget) + ' MM', 'Total Budget', 'navy')}
      ${kpiCard(fmt.num(consumed) + ' MM', 'Consumed', 'orange')}
      ${kpiCard(fmt.num(remaining) + ' MM', 'Remaining', 'green')}
      ${kpiCard(ei, 'Efficiency Index', ei !== '—' && parseFloat(ei) < 1 ? 'orange' : 'green')}
    </div>

    ${kvTable([
      ['Client', fmt.esc(project.client), 'PM', fmt.esc(project.projectManager || project.pm || '—')],
      ['Contract Value', fmt.aed(project.contractValue), 'Team Size', String(team.length || project.teamSize || '—')],
      ['Total Deliverables', String(data.deliverables?.length || '—'), 'Status', fmt.esc(project.status || '—')],
      ['POC', fmt.esc(project.projectManager || '—'), 'Last Claim', fmt.esc(project.lastClaim || '—')],
    ])}

    <h2>1. Monthly Manmonth Consumption</h2>
    <p>Tracks monthly resource consumption against the ${fmt.num(totalBudget)} MM budget. Data from DB-9 Manmonth Consumption Tracker.</p>
    ${dataTable(['Month', 'Consumed MM', 'Cumulative MM', 'Remaining', 'Burn Rate', 'Progress', 'EI', 'Health'],
      monthly.length ? monthly.map(m => {
        const burn = totalBudget > 0 ? ((m.cumulativeConsumed || 0) / totalBudget * 100).toFixed(1) + '%' : '—';
        const ei2 = (m.cumulativeConsumed > 0 && totalBudget > 0)
          ? ((m.actualPct || 0) / (m.cumulativeConsumed / totalBudget)).toFixed(2)
          : '—';
        return [
          fmt.date(m.month),
          fmt.num(m.consumedMM),
          fmt.num(m.cumulativeConsumed),
          fmt.num(totalBudget - (m.cumulativeConsumed || 0)),
          burn,
          fmt.pct(m.actualPct),
          ei2,
          m.health || '—',
        ];
      }) : [['No monthly snapshots yet','—','—','—','—','—','—','—']],
      7)}
    <p><b>Efficiency Index Scale:</b> ≥1.0 Efficient | 0.8–1.0 Acceptable | &lt;0.8 Attention Needed</p>

    <h2>2. Resource Deployment</h2>
    <p>${team.length} team members assigned to this project.</p>
    ${dataTable(['Name', 'Role', 'Discipline', 'Location', 'Status'],
      team.length ? team.slice(0, 25).map(p => [
        fmt.esc(p.name), fmt.esc(p.designation || '—'),
        fmt.esc(p.discipline || '—'), fmt.esc(p.location || '—'),
        p.status || '—',
      ]) : [['—','—','—','—','—']],
      4)}

    <h3>2.1 Role Distribution</h3>
    ${dataTable(['Role', 'Count', '%'],
      roleRows.length ? roleRows : [['—','—','—']])}

    <div class="footer">
      Project: ${fmt.esc(project.name)} | Date: ${today} |
      Source: JES BIM v2 SSOT Hub — DB-11, DB-B, DB-9
    </div>
  `;
  return htmlDoc(`${project.name} — Employee KPI`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MANMONTH EFFICIENCY REPORT
// ─────────────────────────────────────────────────────────────────────────────
function efficiencyHtml(data) {
  const { project, manmonths = [], team = [] } = data;
  const today = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
  const monthly = manmonths.filter(m => m.month).sort((a, b) => (a.month || '').localeCompare(b.month || ''));
  const latest = monthly[monthly.length - 1] || {};
  const totalBudget = latest.budgetedMM || project.manmonthsBudgeted || 0;
  const consumed = latest.cumulativeConsumed || project.manmonthsUsed || 0;
  const remaining = totalBudget - consumed;
  const ei = consumed > 0 ? ((latest.actualPct || 0) / (consumed / totalBudget)).toFixed(2) : '—';

  // Budget projection scenarios
  const monthlyBurn = monthly.length >= 2
    ? ((monthly[monthly.length - 1].cumulativeConsumed - monthly[0].cumulativeConsumed) / (monthly.length - 1))
    : 0;
  const scenarios = [
    ['Current Rate', monthlyBurn.toFixed(1), remaining > 0 && monthlyBurn > 0 ? (remaining / monthlyBurn).toFixed(1) : '—', 'Tight'],
    ['Reduced Rate (60%)', (monthlyBurn * 0.6).toFixed(1), remaining > 0 && monthlyBurn > 0 ? (remaining / (monthlyBurn * 0.6)).toFixed(1) : '—', 'Comfortable'],
    ['Accelerated (130%)', (monthlyBurn * 1.3).toFixed(1), remaining > 0 && monthlyBurn > 0 ? (remaining / (monthlyBurn * 1.3)).toFixed(1) : '—', 'Risk of Overrun'],
  ];

  const body = `
    <div class="header-band">
      <div class="header-band-left"><b>JES BIM OPERATIONS</b><br/>
        <span style="font-size:8pt;color:#A0BACA">Single Source of Truth (SSOT) Hub</span></div>
      <div class="header-band-right">
        ${fmt.num(totalBudget)} MM Budget | ${fmt.num(consumed)} MM Consumed | EI ${ei}
      </div>
    </div>

    <h1 style="text-align:center">Manmonth Efficiency Report</h1>
    <h3 style="color:#2C8E8C">${fmt.esc(project.name)}</h3>
    <p class="meta">${fmt.esc(project.scope || '—')} | Generated ${today}</p>
    <div class="divider"></div>

    <div class="kpi-row">
      ${kpiCard(fmt.num(totalBudget) + ' MM', 'Total Budget', 'navy')}
      ${kpiCard(fmt.num(consumed) + ' MM', 'Consumed', 'orange')}
      ${kpiCard(fmt.num(remaining) + ' MM', 'Remaining', 'green')}
      ${kpiCard(ei, 'Efficiency', ei !== '—' && parseFloat(ei) < 1 ? 'orange' : 'green')}
    </div>

    <h2>1. Monthly Manmonth Consumption</h2>
    ${dataTable(['Month', 'Consumed', 'Cumulative', 'Remaining', 'Burn Rate', 'Progress', 'EI', 'Health'],
      monthly.length ? monthly.map(m => {
        const burn = totalBudget > 0 ? ((m.cumulativeConsumed || 0) / totalBudget * 100).toFixed(1) + '%' : '—';
        const ei2 = (m.cumulativeConsumed > 0 && totalBudget > 0)
          ? ((m.actualPct || 0) / (m.cumulativeConsumed / totalBudget)).toFixed(2)
          : '—';
        return [fmt.date(m.month), fmt.num(m.consumedMM), fmt.num(m.cumulativeConsumed),
                fmt.num(totalBudget - (m.cumulativeConsumed || 0)),
                burn, fmt.pct(m.actualPct), ei2, m.health || '—'];
      }) : [['No data','—','—','—','—','—','—','—']],
      7)}

    <h2>2. Budget Projection Scenarios</h2>
    ${dataTable(['Scenario', 'Monthly Burn (MM)', 'Months Remaining', 'Assessment'],
      scenarios, 3)}

    <h2>3. Resource Deployment</h2>
    ${dataTable(['Name', 'Role', 'Discipline', 'Status'],
      team.length ? team.slice(0, 25).map(p => [
        fmt.esc(p.name), fmt.esc(p.designation || '—'),
        fmt.esc(p.discipline || '—'), p.status || '—',
      ]) : [['—','—','—','—']],
      3)}

    <h2>4. Recommendations</h2>
    <p><b>1.</b> Monitor EI weekly — current ${ei}. If &lt;0.8, immediate resource rebalancing needed.</p>
    <p><b>2.</b> Identify and reassign under-utilised resources (&lt;50% utilisation).</p>
    <p><b>3.</b> Protect high-performers from burnout — redistribute load.</p>
    <p><b>4.</b> Request outstanding inputs to unblock deliverables.</p>
    <p><b>5.</b> Plan resource ramp-down as project approaches close-out.</p>

    <div class="footer">
      Project: ${fmt.esc(project.name)} | Date: ${today} |
      Source: JES BIM v2 SSOT Hub — DB-9, DB-B, DB-4, DB-3
    </div>
  `;
  return htmlDoc(`${project.name} — Efficiency Report`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAYMENT CERTIFICATE
// ─────────────────────────────────────────────────────────────────────────────
function paymentCertHtml(data) {
  const { project, commercial = [], schedule = [] } = data;
  const today = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});

  // Find latest claim record
  const claims = commercial.filter(c => /pa|claim|invoice/i.test(c.invoiceNo || ''));
  const latest = claims.sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || ''))[0] || {};
  const totalCertified = claims.filter(c => /approved|paid/i.test(c.status||'')).reduce((s, c) => s + (c.amount || 0), 0);
  const thisMonth = latest.amount || 0;
  const balance = (project.contractValue || 0) - totalCertified;

  // Commercial milestones
  const commercialMs = schedule.filter(m => /commercial|pa /i.test((m.milestone || '') + ' ' + (m.phase || '')));

  const body = `
    <div style="border-top: 3px solid #E97D2C;"></div>
    <table style="width:100%; border:none; margin-top: 10px;">
      <tr style="border:none">
        <td style="border:none"><h1>Payment Certificate</h1>
          <p><b>${fmt.esc(project.name)}</b> — ${fmt.esc(project.scope || '—')}</p></td>
        <td style="border:none; text-align:right; vertical-align:top; color:#6B7785; font-size:9pt">
          <b>JES BIM Operations</b><br/>${today}</td>
      </tr>
    </table>

    ${dataTable(['Contract Value', 'Certified to Date', 'This Month', 'Balance'],
      [[fmt.aed(project.contractValue), fmt.aed(totalCertified),
        fmt.aed(thisMonth), fmt.aed(balance)]])}

    <h2>1. Certificate Details</h2>
    ${kvTable([
      ['Project', fmt.esc(project.name), 'Client', fmt.esc(project.client || '—')],
      ['Project Code', fmt.esc(project.code || '—'), 'Client Contact', fmt.esc(project.projectManager || '—')],
      ['Contractor', fmt.esc(project.contractor || 'Joseph Engineering Services'), 'Discipline', fmt.esc((project.disciplines||[]).join(' + '))],
      ['Contract Value', fmt.aed(project.contractValue), 'LPO Number', fmt.esc(project.lpoNumber || '—')],
      ['Certificate No.', fmt.esc(latest.invoiceNo || `PC-${claims.length + 1}`), 'Package', fmt.esc(latest.package || '—')],
      ['Invoice ID', fmt.esc(latest.invoiceNo || '—'), 'Status', fmt.esc(latest.status || 'Draft')],
      ['Claim Month', fmt.date(latest.issuedDate), 'Currency', 'AED'],
    ])}

    <h2>2. Certified Amount</h2>
    ${dataTable(['Description', 'Amount (AED)'],
      [['Current Month Certified (this PA)', fmt.aed(thisMonth).replace('AED ', '')],
       ['Previous Cumulative Certified', fmt.aed(totalCertified - thisMonth).replace('AED ', '')],
       ['Total Certified to Date', fmt.aed(totalCertified).replace('AED ', '')],
       ['Balance Remaining', fmt.aed(balance).replace('AED ', '')]])}

    <h2>3. Milestone Summary</h2>
    ${dataTable(['Milestone', 'Weight %', 'Status', 'Certified (AED)'],
      commercialMs.length ? commercialMs.map(m => [
        fmt.esc(m.milestone || '—'),
        fmt.pct(m.plannedPct),
        m.status || '—',
        fmt.aed(((m.actualPct || 0) * (project.contractValue || 0))).replace('AED ', ''),
      ]) : [['(No commercial milestones in DB-2)','—','—','—']],
      2)}

    <h2>4. Remarks</h2>
    <p>• This certificate covers work completed during the current claim period.</p>
    <p>• Certification status reflects entries in DB-8 Commercial as of ${today}.</p>
    <p>• All amounts subject to client commercial verification.</p>

    <h2>5. Authorization</h2>
    <table style="border:none">
      <tr style="border:none">
        <td style="border:none; width:33%; vertical-align:top">
          <b style="color:#1F3B5B">Certified By (JES)</b><br/>Commercial Manager<br/><br/>
          Sign: ___________________<br/>Date: ___________________</td>
        <td style="border:none; width:33%; vertical-align:top">
          <b style="color:#1F3B5B">Reviewed By (Client)</b><br/>Client Representative<br/><br/>
          Sign: ___________________<br/>Date: ___________________</td>
        <td style="border:none; width:33%; vertical-align:top">
          <b style="color:#1F3B5B">Approved By (Client)</b><br/>Authorized Signatory<br/><br/>
          Sign: ___________________<br/>Date: ___________________</td>
      </tr>
    </table>

    <div class="footer">
      ${fmt.esc(project.name)} — Payment Certificate — ${today} |
      Generated from v2 SSOT Hub | Sources: DB-A, DB-8, DB-2
    </div>
  `;
  return htmlDoc(`${project.name} — Payment Certificate`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VARIATION CLAIM COMPILER
// ─────────────────────────────────────────────────────────────────────────────
function variationHtml(data) {
  const { project, deliverables = [], issues = [], comms = [], commercial = [], variations = [] } = data;
  const today = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});

  // Aggregate
  const issueCount = issues.length;
  const hardClash = issues.filter(i => /hard.*clash/i.test(i.type||'')).length;
  const softClash = issues.filter(i => /soft.*clash/i.test(i.type||'')).length;
  const designIssues = issues.filter(i => /design/i.test(i.type||'')).length;

  // Variations by month
  const byMonth = {};
  variations.forEach(v => {
    const month = v.raisedDate ? new Date(v.raisedDate).toLocaleDateString('en-GB', {month:'short', year:'numeric'}) : 'Undated';
    byMonth[month] = byMonth[month] || { count:0, items: [] };
    byMonth[month].count++;
    byMonth[month].items.push(v.name || v.reason);
  });
  const monthRows = Object.entries(byMonth).map(([m, v]) => [m, v.count, fmt.short(v.items.slice(0,3).join(', '), 80), 'Submitted']);

  const totalCostImpact = variations.reduce((s, v) => s + (v.costImpact || 0), 0);
  const totalMmImpact = variations.reduce((s, v) => s + (v.resourceImpact || 0), 0);

  const body = `
    <p style="text-align:center"><i>Joseph Engineering Services</i></p>
    <h1 style="text-align:center">VARIATION CLAIM COMPILER</h1>
    <div class="divider"></div>

    <h2>1. Project Overview</h2>
    ${kvTable([
      ['Project Name', fmt.esc(project.name), 'Project Code', fmt.esc(project.code || '—')],
      ['Client', fmt.esc(project.client || '—'), 'Contractor', fmt.esc(project.contractor || '—')],
      ['Location', fmt.esc(project.location || '—'), 'Contract Value', fmt.aed(project.contractValue)],
      ['Scope', fmt.esc(project.scope || '—'), 'Disciplines', fmt.esc((project.disciplines||[]).join(' + '))],
      ['Start Date', fmt.date(project.startDate), 'Planned End', fmt.date(project.plannedEnd)],
      ['Current Stage', fmt.esc(project.stage || '—'), 'Consultant', fmt.esc(project.consultant || '—')],
      ['Building Plot', fmt.esc(project.buildingPlot || '—'), 'Progress', fmt.pct(project.progress)],
    ])}

    <h2>2. Data Flow</h2>
    ${dataTable(['Step', 'Action', 'Source', 'Details'],
      [['1', 'Read project scope', 'DB-A Projects Master', `${deliverables.length} deliverables in scope`],
       ['2', 'Extract issue evidence', 'DB-4 RFI/Issues/Clash', `${issueCount} issues (${hardClash} hard clash + ${softClash} soft + ${designIssues} design)`],
       ['3', 'Extract communications', 'DB-5 Communications', `${comms.length} records`],
       ['4', 'Read commercial baseline', 'DB-8 Invoicing BOQ', `Contract: ${fmt.aed(project.contractValue)}`],
       ['5', 'Compile variation register', 'DB-10 Variation Register', `${variations.length} variations`],
       ['6', 'Generate claim output', 'DB-10 Output', 'Structured claim with evidence mapping']])}

    <h2>3. Commercial Summary</h2>
    ${kvTable([
      ['Total Contract Value', fmt.aed(project.contractValue)],
      ['Cumulative Claimed (DB-8)', fmt.aed(commercial.filter(c => /approved|paid/i.test(c.status||'')).reduce((s,c) => s + (c.amount||0), 0))],
      ['Total Variation Cost Impact', fmt.aed(totalCostImpact)],
      ['Total Variation MM Impact', fmt.num(totalMmImpact, 1) + ' MM'],
      ['Active Variations', String(variations.filter(v => /submitted|pending|approved/i.test(v.status||'')).length)],
      ['Variation Count', String(variations.length)],
    ], false)}

    <h2>4. Variation Drawing Register</h2>
    <h3>4.1 Variation Detail</h3>
    ${dataTable(['Variation', 'Reason', 'Cost (AED)', 'MM Impact', 'Status'],
      variations.length ? variations.slice(0, 15).map(v => [
        fmt.short(v.name || v.title, 50),
        fmt.esc(v.reason || '—'),
        fmt.aed(v.costImpact).replace('AED ', ''),
        fmt.num(v.resourceImpact, 1),
        v.status || '—',
      ]) : [['(No variations recorded in DB-10)','—','—','—','—']],
      4)}

    <h3>4.2 Variations by Month</h3>
    ${dataTable(['Month', 'Count', 'Key Variations', 'Status'],
      monthRows.length ? monthRows : [['—','—','—','—']],
      3)}

    <div class="footer">
      ${fmt.esc(project.name)} — Variation Claim Compiler — ${today} |
      Generated from v2 SSOT Hub | Sources: DB-A, DB-1, DB-4, DB-5, DB-8, DB-10
    </div>
  `;
  return htmlDoc(`${project.name} — Variation Claim`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  monthlyProgressHtml,
  employeeKpiHtml,
  efficiencyHtml,
  paymentCertHtml,
  variationHtml,
};
