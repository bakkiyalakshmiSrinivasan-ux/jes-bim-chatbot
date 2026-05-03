// api/report/templates.js
// 18 JES BIM report templates (16 original + 2 IPA templates added May 2026).
// Each function takes a plain data object and returns a pdfmake
// doc-definition matching JES_BIM_Master_Template_Pack.pdf v1.0.

const h = require('./helpers');
const c = require('./calculations');
const { BRAND, TEXT, PAGE } = h;

// ============================================================
// Registry ----------------------------------------------------
// ============================================================
const REGISTRY = {
  // Part A — Lump-Sum
  lump_sum_invoice: { name: 'Lump Sum Monthly Invoice', part: 'A', fn: lumpSumInvoice },
  progress_report: { name: 'Monthly Progress Report', part: 'A', fn: progressReport },
  manmonth_report: { name: 'Manmonth Efficiency Report', part: 'A', fn: manmonthReport },
  employee_kpi: { name: 'Employee KPI Report', part: 'A', fn: employeeKpi },
  variation_report: { name: 'Variation Claim Report', part: 'A', fn: variationReport },
  kickoff_document: { name: 'Project Kickoff Document', part: 'A', fn: kickoffDocument },
  portfolio_summary: { name: 'Portfolio Billing Summary', part: 'A', fn: portfolioSummary },
  kpi_dashboard: { name: 'KPI Dashboard Report', part: 'A', fn: kpiDashboard },
  bench_report: { name: 'Bench Resource Report', part: 'A', fn: benchReport },
  attendance_report: { name: 'Daily Attendance Report', part: 'A', fn: attendanceReport },
  // Part B — Resourcing
  resourcing_invoice: { name: 'Resourcing Monthly Invoice', part: 'B', fn: resourcingInvoice },
  resourcing_monthly_report: { name: 'Resourcing Monthly Report', part: 'B', fn: resourcingMonthlyReport },
  resource_utilization: { name: 'Resource Utilization Report', part: 'B', fn: resourceUtilization },
  resourcing_kpi: { name: 'Resourcing KPI Report', part: 'B', fn: resourcingKpi },
  resource_variation: { name: 'Resource Variation Report', part: 'B', fn: resourceVariation },
  portfolio_resourcing_summary: { name: 'Portfolio Resourcing Billing Summary', part: 'B', fn: portfolioResourcingSummary },
  // Part C — Interim Payment Applications
  ipa_afe:     { name: 'Interim Payment Application — AFE Style',     part: 'C', fn: ipaAfe },
  ipa_altayer: { name: 'Interim Payment Application — AlTayer Style', part: 'C', fn: ipaAlTayer },
};

function build(templateId, data) {
  const entry = REGISTRY[templateId];
  if (!entry) throw new Error('Unknown template_id: ' + templateId);
  return entry.fn(data || {});
}

function list() {
  return Object.entries(REGISTRY).map(([id, v]) => ({ id, name: v.name, part: v.part }));
}

// ============================================================
// Doc scaffold -----------------------------------------------
// ============================================================
function scaffold(theme, rightLabel, isResourcing, content) {
  return {
    pageSize: PAGE.size,
    pageMargins: PAGE.margins,
    header: isResourcing ? h.headerBandResourcing(rightLabel) : h.headerBand(theme, rightLabel),
    footer: h.footerBand(theme),
    defaultStyle: { font: 'DejaVuSans', fontSize: 10, color: TEXT.ink },
    content,
  };
}

// ============================================================
// 1. Lump Sum Monthly Invoice (PA) ---------------------------
// ============================================================
function lumpSumInvoice(d) {
  const t = BRAND.lumpSum;
  const p = d.project || {};
  const fin = d.financial || {};
  const milestones = d.milestones || [];
  const cumulative = d.cumulativeBilling || [];
  const prepared = d.preparedBy || {};
  const approved = d.approvedBy || {};

  // Calculations
  const currentBilling = fin.currentBilling != null ? Number(fin.currentBilling) : null;
  const previousBilling = fin.previousBilling != null ? Number(fin.previousBilling) : null;
  const cumBilling = currentBilling != null && previousBilling != null
    ? c.cumulativeBilling(previousBilling, currentBilling) : fin.cumulativeBilling;
  const ret = fin.retention != null ? Number(fin.retention) : c.retention(currentBilling || 0);
  const netPay = fin.netPayable != null ? Number(fin.netPayable) : c.netPayable(currentBilling || 0, ret);
  const bal = fin.balance != null ? Number(fin.balance) : c.balance(fin.contractValue, cumBilling);

  const milestoneRows = milestones.map(m => [
    m.name || '—',
    m.weightPct != null ? h.pct(m.weightPct, 0) : '—',
    m.status || '—',
    m.completionPct != null ? h.pct(m.completionPct, 0) : '—',
    m.amount != null ? h.money(m.amount) : '—',
  ]);
  milestoneRows.push([
    { text: 'Total', bold: true },
    { text: '100%', bold: true },
    '—',
    '—',
    { text: h.money(currentBilling), bold: true },
  ]);

  const cumRows = cumulative.map(r => [r.period || '—', h.money(r.claim), h.money(r.cumulative), h.pct(r.pctOfContract, 1)]);

  return scaffold(t, 'Invoice (PA)', false, [
    ...h.pageTitle(t, 'Lump Sum Monthly Invoice', 'Payment Application — Lump Sum Contract'),

    h.sectionTitle(t, 'Project Information'),
    h.infoTable(t, [
      ['Project Name', p.name],
      ['Client', p.client],
      ['Contractor', p.contractor || 'JES BIM'],
      ['Invoice No', p.invoiceNo],
      ['Month', p.month],
      ['Date Issued', p.dateIssued],
    ]),

    h.sectionTitle(t, 'Financial Summary'),
    h.dataTable(t,
      ['Description', 'Amount (AED)'],
      [
        ['Contract Value', h.money(fin.contractValue)],
        ['Previous Billing', h.money(previousBilling)],
        ['Current Billing', h.money(currentBilling)],
        ['Cumulative Billing', h.money(cumBilling)],
        ['Retention (5%)', h.money(ret)],
        ['Net Payable', h.money(netPay)],
        ['Balance', h.money(bal)],
      ],
      { widths: ['*', 180] }
    ),

    h.sectionTitle(t, 'Milestone Breakdown'),
    h.dataTable(t,
      ['Milestone', 'Weight %', 'Status', 'Completion %', 'Amount (AED)'],
      milestoneRows,
      { widths: ['*', 70, 80, 80, 110] }
    ),

    h.sectionTitle(t, 'Cumulative Billing'),
    h.dataTable(t,
      ['Period', 'Claim (AED)', 'Cumulative (AED)', '% of Contract'],
      cumRows.length ? cumRows : [[ '—', '—', '—', '—' ]],
      { widths: ['*', '*', '*', 100] }
    ),

    h.sectionTitle(t, 'Balance Verification'),
    h.kvBullets([
      ['Contract Value', h.money(fin.contractValue)],
      ['Total Claimed', h.money(cumBilling)],
      ['Balance', h.money(bal)],
    ]),
    h.validationBadge(d.status || 'verified'),

    h.sectionTitle(t, 'Payment Certificate'),
    { text: 'We certify that the above work has been completed as per the contract terms.', italics: true, color: TEXT.muted, fontSize: 9.5, margin: [0, 0, 0, 6] },
    h.signatureBlock(t, prepared, approved),
  ]);
}

// ============================================================
// 2. Monthly Progress Report ---------------------------------
// ============================================================
function progressReport(d) {
  const t = BRAND.lumpSum;
  const o = d.overview || {};
  const milestones = d.milestones || [];
  const schedule = d.schedule || [];
  const deliverables = d.deliverables || [];
  const issues = d.issues || [];
  const action = d.actionPlan || {};

  const milestoneRows = milestones.map(m => [
    m.name || '—',
    h.pct(m.plannedPct, 0),
    h.pct(m.actualPct, 0),
    m.variance != null ? (m.variance > 0 ? '+' : '') + h.pct(m.variance, 0) : '—',
    m.status || '—',
  ]);
  const scheduleRows = schedule.map(s => [s.activity || '—', s.plannedDate || '—', s.actualDate || '—', s.status || '—']);
  const deliverableRows = deliverables.map(x => [x.package || '—', x.planned || '—', x.submitted || '—', x.approved || '—', x.status || '—']);
  const issueRows = issues.map(i => [i.issue || '—', i.impact || '—', i.status || '—', i.owner || '—']);

  return scaffold(t, 'Progress Report', false, [
    ...h.pageTitle(t, 'Monthly Progress Report', 'Project status, milestones, deliverables & risks'),

    h.sectionTitle(t, 'Project Overview'),
    h.infoTable(t, [
      ['Project Name', o.projectName],
      ['Period', o.period],
      ['Overall Progress %', o.overallProgressPct != null ? h.pct(o.overallProgressPct, 1) : null],
      ['Status', o.status],
      ['Report Prepared By', o.preparedBy],
      ['Date', o.date],
    ]),

    h.sectionTitle(t, 'Progress Tracking'),
    h.dataTable(t,
      ['Milestone', 'Planned %', 'Actual %', 'Variance', 'Status'],
      milestoneRows.length ? milestoneRows : [[ '—', '—', '—', '—', '—' ]],
      { widths: ['*', 70, 70, 70, 90] }
    ),

    h.sectionTitle(t, 'Schedule Status'),
    h.dataTable(t,
      ['Activity', 'Planned Date', 'Actual Date', 'Status'],
      scheduleRows.length ? scheduleRows : [[ '—', '—', '—', '—' ]],
      { widths: ['*', 110, 110, 110] }
    ),

    h.sectionTitle(t, 'Deliverables'),
    h.dataTable(t,
      ['Package', 'Planned', 'Submitted', 'Approved', 'Status'],
      deliverableRows.length ? deliverableRows : [[ '—', '—', '—', '—', '—' ]],
      { widths: ['*', 70, 80, 80, 90] }
    ),

    h.sectionTitle(t, 'Issues & Risks'),
    h.dataTable(t,
      ['Issue', 'Impact', 'Status', 'Owner'],
      issueRows.length ? issueRows : [[ '—', '—', '—', '—' ]],
      { widths: ['*', 100, 100, 110] }
    ),

    h.sectionTitle(t, 'Action Plan'),
    h.kvBullets([
      ['Next Steps', action.nextSteps],
      ['Delays / Blockers', action.blockers],
      ['Decisions Required', action.decisionsRequired],
    ]),
  ]);
}

// ============================================================
// 3. Manmonth Efficiency Report ------------------------------
// ============================================================
function manmonthReport(d) {
  const t = BRAND.lumpSum;
  const s = d.summary || {};
  const resources = d.resources || [];
  const discipline = d.discipline || [];
  const productivity = d.productivity || [];
  const insights = d.insights || {};

  const plannedHours = s.plannedHours != null ? Number(s.plannedHours) : null;
  const actualHours = s.actualHours != null ? Number(s.actualHours) : null;
  const effPct = s.efficiencyPct != null ? Number(s.efficiencyPct) : c.efficiencyPct(plannedHours, actualHours);
  const utilPct = s.utilizationPct != null ? Number(s.utilizationPct) : null;

  const resourceRows = resources.map(r => [
    r.name || '—', r.role || '—', r.plannedHours || '—', r.actualHours || '—',
    r.utilizationPct != null ? h.pct(r.utilizationPct, 1) : '—',
    r.efficiencyPct != null ? h.pct(r.efficiencyPct, 1) : '—',
  ]);
  const disciplineRows = (discipline.length ? discipline : [
    { name: 'Architectural' }, { name: 'Structural' }, { name: 'MEP' }, { name: 'BIM Coordination' }
  ]).map(x => [x.name, x.plannedHours || '—', x.actualHours || '—', x.varianceHours || '—']);
  const productivityRows = productivity.map(p => [p.deliverable || '—', p.hours || '—', p.outputUnits || '—', p.rateUnitsPerHour || '—']);

  return scaffold(t, 'Manmonth Report', false, [
    ...h.pageTitle(t, 'Manmonth Efficiency Report', 'Planned vs Actual hours, utilization and productivity'),

    h.sectionTitle(t, 'Summary'),
    h.infoTable(t, [
      ['Project / Dept', s.scope],
      ['Period', s.period],
      ['Planned Hours', plannedHours],
      ['Actual Hours', actualHours],
      ['Efficiency %', effPct != null && isFinite(effPct) ? h.pct(effPct, 1) : null],
      ['Utilization %', utilPct != null && isFinite(utilPct) ? h.pct(utilPct, 1) : null],
    ]),

    h.sectionTitle(t, 'Resource Utilization'),
    h.dataTable(t,
      ['Employee', 'Role', 'Planned (h)', 'Actual (h)', 'Utilization %', 'Efficiency %'],
      resourceRows.length ? resourceRows : [[ '—', '—', '—', '—', '—', '—' ]],
      { widths: ['*', 80, 60, 60, 70, 70] }
    ),

    h.sectionTitle(t, 'Discipline Breakdown'),
    h.dataTable(t,
      ['Discipline', 'Planned (h)', 'Actual (h)', 'Variance (h)'],
      disciplineRows,
      { widths: ['*', 90, 90, 90] }
    ),

    h.sectionTitle(t, 'Productivity'),
    h.dataTable(t,
      ['Deliverable', 'Hours', 'Output (units)', 'Rate (units/h)'],
      productivityRows.length ? productivityRows : [[ '—', '—', '—', '—' ]],
      { widths: ['*', 80, 100, 100] }
    ),

    h.sectionTitle(t, 'Insights'),
    h.kvBullets([
      ['Overutilized (>110%)', (insights.overutilized || []).join(', ')],
      ['Underutilized (<70%)', (insights.underutilized || []).join(', ')],
      ['Recommended Action', insights.recommendedAction],
    ]),
  ]);
}

// ============================================================
// 4. Employee KPI Report -------------------------------------
// ============================================================
function employeeKpi(d) {
  const t = BRAND.lumpSum;
  const e = d.employee || {};
  const metrics = d.metrics || [];
  const final = d.final || {};

  const totalWeight = metrics.reduce((s, m) => s + (Number(m.weightPct) || 0), 0);
  const metricRows = metrics.map(m => {
    const score = m.score != null ? Number(m.score) : null;
    const weight = m.weightPct != null ? Number(m.weightPct) : null;
    const weighted = (score != null && weight != null) ? (weight * score) / 100 : null;
    return [m.metric || '—', weight, score, weighted != null ? weighted.toFixed(1) : '—'];
  });
  metricRows.push([
    { text: 'Total', bold: true },
    { text: totalWeight, bold: true },
    '—',
    { text: (final.kpiScore != null ? Number(final.kpiScore).toFixed(1) : c.weightedKpiScore(metrics).toFixed(1)), bold: true },
  ]);
  const rating = final.rating || c.kpiRating(final.kpiScore != null ? final.kpiScore : c.weightedKpiScore(metrics));

  return scaffold(t, 'Employee KPI', false, [
    ...h.pageTitle(t, 'Employee KPI Report', 'Individual scorecard for monthly performance review'),

    h.sectionTitle(t, 'Employee Details'),
    h.infoTable(t, [
      ['Name', e.name],
      ['Employee ID', e.id],
      ['Role', e.role],
      ['Department', e.department],
      ['Project(s)', e.projects],
      ['Period', e.period],
      ['Reporting Manager', e.manager],
    ]),

    h.sectionTitle(t, 'KPI Metrics'),
    h.dataTable(t,
      ['Metric', 'Weight %', 'Score (0–100)', 'Weighted Score'],
      metricRows,
      { widths: ['*', 90, 110, 110] }
    ),

    h.sectionTitle(t, 'Final Score'),
    h.kvBullets([
      ['KPI Score', (final.kpiScore != null ? final.kpiScore : c.weightedKpiScore(metrics).toFixed(1)) + ' / 100'],
      ['Rating', rating],
      ['Recommendation', final.recommendation],
    ]),

    h.sectionTitle(t, 'Manager Comments'),
    { text: h.fmt(final.comments), italics: true, color: TEXT.muted, fontSize: 9.5 },
  ]);
}

// ============================================================
// 5. Variation Claim Report ----------------------------------
// ============================================================
function variationReport(d) {
  const t = BRAND.lumpSum;
  const v = d.variation || {};
  const impact = d.impact || {};
  const docs = d.supportingDocuments || [];
  const approval = d.approval || {};

  const docRows = docs.map(x => [x.document || '—', x.reference || '—']);

  return scaffold(t, 'Variation Report', false, [
    ...h.pageTitle(t, 'Variation Claim Report', 'Scope change impact and approval tracking'),

    h.sectionTitle(t, 'Variation Details'),
    h.infoTable(t, [
      ['Project', v.project],
      ['Variation ID', v.id],
      ['Date Raised', v.dateRaised],
      ['Description', v.description],
      ['Reason / Trigger', v.reason],
      ['Raised By', v.raisedBy],
    ]),

    h.sectionTitle(t, 'Impact'),
    h.dataTable(t,
      ['Impact Type', 'Value'],
      [
        ['Cost Impact (AED)', impact.costAED != null ? (impact.costAED >= 0 ? '+' : '') + h.money(impact.costAED) : '±—'],
        ['Time Impact (days)', impact.timeDays != null ? (impact.timeDays >= 0 ? '+' : '') + impact.timeDays : '±—'],
        ['Resource Impact (manmonths)', impact.resourceManmonths != null ? (impact.resourceManmonths >= 0 ? '+' : '') + impact.resourceManmonths : '±—'],
      ],
      { widths: ['*', '*'] }
    ),

    h.sectionTitle(t, 'Supporting Documents'),
    h.dataTable(t,
      ['Document', 'Reference'],
      docRows.length ? docRows : [[ '—', '—' ]],
      { widths: ['*', 220] }
    ),

    h.sectionTitle(t, 'Approval Status'),
    h.kvBullets([
      ['Status', approval.status],
      ['Approved By', approval.approvedBy],
      ['Approval Date', approval.approvalDate],
      ['Remarks', approval.remarks],
    ]),
  ]);
}

// ============================================================
// 6. Project Kickoff Document --------------------------------
// ============================================================
function kickoffDocument(d) {
  const t = BRAND.lumpSum;
  const info = d.projectInfo || {};
  const deliverables = d.deliverables || [];
  const team = d.team || [];
  const milestones = d.milestones || [];
  const risks = d.risks || [];

  const deliverableRows = deliverables.map(x => [x.deliverable || '—', x.discipline || '—', x.deadline || '—']);
  const teamRows = team.map(x => [x.name || '—', x.role || '—', x.allocationPct != null ? h.pct(x.allocationPct, 0) : '—']);
  const milestoneRows = (milestones.length ? milestones : [
    { name: 'Kickoff', owner: 'PM' }, { name: 'LOD 200 Submission', owner: 'BIM Lead' },
    { name: 'LOD 350 Submission', owner: 'BIM Lead' }, { name: 'Final Handover', owner: 'PM' },
  ]).map(m => [m.name, m.date || '—', m.owner || '—']);
  const riskRows = risks.map(r => [r.item || '—', r.type || 'Risk / Assumption', r.mitigation || '—']);

  return scaffold(t, 'Kickoff Document', false, [
    ...h.pageTitle(t, 'Project Kickoff Document', 'Charter for new BIM project engagements'),

    h.sectionTitle(t, 'Project Info'),
    h.infoTable(t, [
      ['Project Name', info.name],
      ['Project Code', info.code],
      ['Client', info.client],
      ['Location', info.location],
      ['Contract Value', info.contractValue != null ? h.money(info.contractValue) : null],
      ['Start Date', info.startDate],
      ['End Date', info.endDate],
      ['Duration', info.duration],
    ]),

    h.sectionTitle(t, 'Scope of Work'),
    { text: h.fmt(d.scopeOfWork) + '  (LOD levels, disciplines, deliverable types)', italics: d.scopeOfWork == null, color: d.scopeOfWork == null ? TEXT.muted : TEXT.ink, fontSize: 9.5, margin: [0, 0, 0, 6] },

    h.sectionTitle(t, 'Deliverables'),
    h.dataTable(t,
      ['Deliverable', 'Discipline', 'Deadline'],
      deliverableRows.length ? deliverableRows : [[ '—', 'Arch / Struct / MEP', '—' ]],
      { widths: ['*', 140, 120] }
    ),

    h.sectionTitle(t, 'Team Structure'),
    h.dataTable(t,
      ['Name', 'Role', 'Allocation %'],
      teamRows.length ? teamRows : [
        ['—', 'Project Manager', '—'], ['—', 'BIM Lead', '—'], ['—', 'Modeler', '—'], ['—', 'QA/QC', '—'],
      ],
      { widths: ['*', 160, 100] }
    ),

    h.sectionTitle(t, 'Timeline / Key Milestones'),
    h.dataTable(t,
      ['Milestone', 'Date', 'Owner'],
      milestoneRows,
      { widths: ['*', 130, 110] }
    ),

    h.sectionTitle(t, 'Risks & Assumptions'),
    h.dataTable(t,
      ['Item', 'Type', 'Mitigation'],
      riskRows.length ? riskRows : [[ '—', 'Risk / Assumption', '—' ]],
      { widths: ['*', 120, '*'] }
    ),
  ]);
}

// ============================================================
// 7. Portfolio Billing Summary -------------------------------
// ============================================================
function portfolioSummary(d) {
  const t = BRAND.lumpSum;
  const o = d.overview || {};
  const projects = d.projects || [];
  const statuses = d.statusDistribution || [];

  const totalContract = projects.reduce((s, p) => s + (Number(p.contract) || 0), 0);
  const totalClaimed = projects.reduce((s, p) => s + (Number(p.claimed) || 0), 0);
  const totalBalance = projects.reduce((s, p) => s + (Number(p.balance) || 0), 0);

  const projectRows = projects.map(p => [
    p.name || '—',
    h.money(p.contract),
    h.money(p.claimed),
    h.money(p.balance),
    p.pctComplete != null ? h.pct(p.pctComplete, 0) : '—',
  ]);
  projectRows.push([
    { text: 'Total', bold: true },
    { text: h.money(totalContract), bold: true },
    { text: h.money(totalClaimed), bold: true },
    { text: h.money(totalBalance), bold: true },
    '—',
  ]);

  const statusRows = (statuses.length ? statuses : [
    { status: 'Active' }, { status: 'On Hold' }, { status: 'Completed' },
  ]).map(s => [s.status, s.count != null ? s.count : '—', s.value != null ? h.money(s.value) : '—']);

  return scaffold(t, 'Portfolio Summary', false, [
    ...h.pageTitle(t, 'Portfolio Billing Summary', 'Multi-project billing roll-up for leadership review'),

    h.sectionTitle(t, 'Overview'),
    h.infoTable(t, [
      ['Reporting Period', o.period],
      ['Total Projects', o.totalProjects != null ? o.totalProjects : projects.length],
      ['Total Contract Value (AED)', o.totalContractValue != null ? h.money(o.totalContractValue) : h.money(totalContract)],
      ['Total Claimed (AED)', o.totalClaimed != null ? h.money(o.totalClaimed) : h.money(totalClaimed)],
      ['Outstanding (AED)', o.outstanding != null ? h.money(o.outstanding) : h.money(totalBalance)],
      ['Collection Efficiency %', o.collectionEfficiencyPct != null ? h.pct(o.collectionEfficiencyPct, 1) : null],
    ]),

    h.sectionTitle(t, 'Project Breakdown'),
    h.dataTable(t,
      ['Project', 'Contract (AED)', 'Claimed (AED)', 'Balance (AED)', '% Complete'],
      projectRows,
      { widths: ['*', 90, 90, 90, 70] }
    ),

    h.sectionTitle(t, 'Status Distribution'),
    h.dataTable(t,
      ['Status', 'Count', 'Value (AED)'],
      statusRows,
      { widths: ['*', 100, 160] }
    ),
  ]);
}

// ============================================================
// 8. KPI Dashboard Report ------------------------------------
// ============================================================
function kpiDashboard(d) {
  const t = BRAND.lumpSum;
  const metrics = d.metrics || [];
  const trends = d.trends || [];
  const insights = d.insights || {};

  const metricDefaults = [
    { kpi: 'Productivity %', target: 90 },
    { kpi: 'Approval Rate %', target: 95 },
    { kpi: 'Delay Rate %', target: '≤5' },
    { kpi: 'Utilization %', target: 85 },
    { kpi: 'Rework %', target: '≤10' },
  ];
  const baseMetrics = metrics.length ? metrics : metricDefaults;
  const metricRows = baseMetrics.map(m => {
    const actual = m.actual != null ? m.actual : '—';
    const variance = m.variance != null ? m.variance
      : (isFinite(Number(m.actual)) && isFinite(Number(m.target)) ? c.variance(m.actual, m.target) : '—');
    const status = m.status || (isFinite(variance) ? (Math.abs(variance) <= 2 ? '✔' : Math.abs(variance) >= 10 ? '✘' : '■') : '✔ / ■ / ✘');
    return [m.kpi || '—', m.target != null ? m.target : '—', actual, variance, status];
  });

  const trendRows = trends.map(r => [r.month || '—', r.productivity || '—', r.approval || '—', r.delay || '—', r.utilization || '—']);

  return scaffold(t, 'KPI Dashboard', false, [
    ...h.pageTitle(t, 'KPI Dashboard Report', 'Operational KPIs with trends and insights'),

    h.sectionTitle(t, 'Metrics'),
    h.dataTable(t,
      ['KPI', 'Target', 'Actual', 'Variance', 'Status'],
      metricRows,
      { widths: ['*', 70, 70, 70, 70] }
    ),

    h.sectionTitle(t, 'Trends'),
    h.dataTable(t,
      ['Month', 'Productivity', 'Approval', 'Delay', 'Utilization'],
      trendRows.length ? trendRows : Array(6).fill(['< MMM >', '—', '—', '—', '—']),
      { widths: ['*', 90, 90, 90, 90] }
    ),

    h.sectionTitle(t, 'Insights'),
    h.kvBullets([
      ['Key Observations', insights.keyObservations],
      ['Wins', insights.wins],
      ['Concerns', insights.concerns],
      ['Recommended Actions', insights.recommendedActions],
    ]),
  ]);
}

// ============================================================
// 9. Bench Resource Report -----------------------------------
// ============================================================
function benchReport(d) {
  const t = BRAND.lumpSum;
  const s = d.summary || {};
  const resources = d.resources || [];
  const depts = d.departmentSplit || [];
  const action = d.actionPlan || {};

  const resourceRows = resources.map(r => [
    r.name || '—',
    r.role || '—',
    r.department || 'Arch / MEP',
    r.skills || '—',
    r.lastProject || '—',
    r.idleDays != null ? r.idleDays : '—',
    r.recommendation || 'Redeploy / Train / Release',
  ]);
  const deptRows = (depts.length ? depts : [
    { department: 'Architectural' }, { department: 'MEP' }, { department: 'Structural' },
  ]).map(x => [x.department, x.benchCount != null ? x.benchCount : '—', x.benchPct != null ? h.pct(x.benchPct, 1) : '—']);

  return scaffold(t, 'Bench Report', false, [
    ...h.pageTitle(t, 'Bench Resource Report', 'Unassigned employees, idle days and redeployment plan'),

    h.sectionTitle(t, 'Summary'),
    h.infoTable(t, [
      ['Reporting Date', s.reportingDate],
      ['Total Employees', s.totalEmployees],
      ['Bench Count', s.benchCount],
      ['Bench %', s.benchPct != null ? h.pct(s.benchPct, 1)
        : (s.benchCount != null && s.totalEmployees ? h.pct(c.benchPct(s.benchCount, s.totalEmployees), 1) : null)],
      ['Avg Idle Days', s.avgIdleDays],
      ['Est. Monthly Bench Cost (AED)', s.estMonthlyCost != null ? h.money(s.estMonthlyCost) : null],
    ]),

    h.sectionTitle(t, 'Resource List'),
    h.dataTable(t,
      ['Employee', 'Role', 'Dept', 'Skills', 'Last Project', 'Idle Days', 'Recommendation'],
      resourceRows.length ? resourceRows : [[ '—', '—', 'Arch / MEP', '—', '—', '—', 'Redeploy / Train / Release' ]],
      { widths: [70, 60, 45, 70, '*', 45, 90] }
    ),

    h.sectionTitle(t, 'Department Split'),
    h.dataTable(t,
      ['Department', 'Bench Count', 'Bench %'],
      deptRows,
      { widths: ['*', 120, 120] }
    ),

    h.sectionTitle(t, 'Action Plan'),
    h.kvBullets([
      ['Redeploy', (action.redeploy || []).join(', ')],
      ['Upskill / Training', (action.upskill || []).join(', ')],
      ['Release / Exit', (action.release || []).join(', ')],
    ]),
  ]);
}

// ============================================================
// 10. Daily Attendance Report --------------------------------
// ============================================================
function attendanceReport(d) {
  const t = BRAND.lumpSum;
  const head = d.header || {};
  const rows = d.attendance || [];
  const sum = d.summary || {};

  const attendanceRows = rows.map(r => [
    r.name || '—', r.role || '—', r.checkIn || 'HH:MM', r.checkOut || 'HH:MM',
    r.hours != null ? r.hours : '—',
    r.status || 'Present / Absent / Leave / WFH',
  ]);

  return scaffold(t, 'Attendance Report', false, [
    ...h.pageTitle(t, 'Daily Attendance Report', 'Check-in / Check-out log and daily summary'),

    h.sectionTitle(t, 'Header'),
    h.infoTable(t, [
      ['Date', head.date],
      ['Location', head.location || 'Office / Site'],
      ['Shift', head.shift || 'General / Night'],
      ['Prepared By', head.preparedBy],
    ]),

    h.sectionTitle(t, 'Attendance'),
    h.dataTable(t,
      ['Employee', 'Role', 'Check-in', 'Check-out', 'Hours', 'Status'],
      attendanceRows.length ? attendanceRows : Array(6).fill([
        '—', '—', 'HH:MM', 'HH:MM', '—', 'Present / Absent / Leave / WFH',
      ]),
      { widths: ['*', 80, 60, 60, 50, 110] }
    ),

    h.sectionTitle(t, 'Summary'),
    h.dataTable(t,
      ['Metric', 'Count'],
      [
        ['Present', sum.present],
        ['Absent', sum.absent],
        ['Leave (Sick / Annual)', sum.leave],
        ['WFH', sum.wfh],
        ['Overtime Hours', sum.overtimeHours],
        ['Late Arrivals', sum.lateArrivals],
      ],
      { widths: ['*', 160] }
    ),

    h.sectionTitle(t, 'Notes'),
    { text: h.fmt(d.notes) + (d.notes ? '' : '  (leave approvals, incidents, or notes)'), italics: !d.notes, color: !d.notes ? TEXT.muted : TEXT.ink, fontSize: 9.5 },
  ]);
}

// ============================================================
// 11. Resourcing Monthly Invoice (PA) ------------------------
// ============================================================
function resourcingInvoice(d) {
  const t = BRAND.resourcing;
  const p = d.project || {};
  const resources = d.resources || [];
  const fin = d.financial || {};
  const timesheet = d.timesheet || [];
  const prepared = d.preparedBy || {};
  const approved = d.approvedBy || {};

  const totalHours = resources.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const totalAmount = resources.reduce((s, r) => s + (Number(r.amount) != null && Number(r.amount) !== 0
    ? Number(r.amount)
    : (Number(r.hours) || 0) * (Number(r.rateAEDHr) || 0)), 0);

  const resourceRows = resources.map(r => {
    const amt = r.amount != null ? Number(r.amount) : c.resourcingBilling(r.hours, r.rateAEDHr);
    return [r.name || '—', r.role || '—', r.hours != null ? r.hours : '—',
      r.rateAEDHr != null ? h.money(r.rateAEDHr, '') : '—', h.money(amt)];
  });
  resourceRows.push([
    { text: 'Total', bold: true }, '—', { text: totalHours || '—', bold: true },
    '—', { text: h.money(totalAmount), bold: true },
  ]);

  const timesheetRows = timesheet.map(x => [
    x.name || '—', x.totalHours != null ? x.totalHours : '—',
    x.billable != null ? x.billable : '—', x.nonBillable != null ? x.nonBillable : '—',
  ]);

  return scaffold(t, 'Resourcing Invoice (PA)', true, [
    ...h.pageTitle(t, 'Resourcing Monthly Invoice', 'Payment Application — Manpower / Resourcing Contract'),

    h.sectionTitle(t, 'Project Information'),
    h.infoTable(t, [
      ['Project Name', p.name],
      ['Client', p.client],
      ['Billing Month', p.billingMonth],
      ['Invoice No', p.invoiceNo],
      ['Date Issued', p.dateIssued],
    ]),

    h.sectionTitle(t, 'Resource Billing Summary'),
    h.dataTable(t,
      ['Resource', 'Role', 'Hours', 'Rate (AED/hr)', 'Amount (AED)'],
      resourceRows,
      { widths: ['*', 110, 60, 90, 110] }
    ),

    h.sectionTitle(t, 'Financial Summary'),
    h.dataTable(t,
      ['Description', 'Amount (AED)'],
      [
        ['Total Hours', fin.totalHours != null ? fin.totalHours : totalHours || '—'],
        ['Gross Amount', h.money(fin.grossAmount != null ? fin.grossAmount : totalAmount)],
        ['Deductions', fin.deductions != null ? h.money(fin.deductions) : '—'],
        ['Net Payable', h.money(fin.netPayable != null ? fin.netPayable
          : (totalAmount - (Number(fin.deductions) || 0)))],
      ],
      { widths: ['*', 180] }
    ),

    h.sectionTitle(t, 'Timesheet Summary'),
    h.dataTable(t,
      ['Employee', 'Total Hours', 'Billable', 'Non-Billable'],
      timesheetRows.length ? timesheetRows : [[ '—', '—', '—', '—' ]],
      { widths: ['*', 100, 80, 100] }
    ),

    h.sectionTitle(t, 'Payment Certification'),
    { text: 'We certify that the above resources have worked as per the agreed contract.', italics: true, color: TEXT.muted, fontSize: 9.5, margin: [0, 0, 0, 6] },
    h.signatureBlock(t, prepared, approved),
  ]);
}

// ============================================================
// 12. Resourcing Monthly Report ------------------------------
// ============================================================
function resourcingMonthlyReport(d) {
  const t = BRAND.resourcing;
  const o = d.overview || {};
  const alloc = d.allocation || [];
  const work = d.workSummary || [];
  const util = d.utilization || {};
  const hi = d.highlights || {};

  const allocRows = alloc.map(x => [x.name || '—', x.role || '—', x.project || '—', x.status || 'Active / Bench / On Leave']);
  const workRows = work.map(x => [x.name || '—', x.tasks || '—', x.hours != null ? x.hours : '—', x.output || '—']);

  return scaffold(t, 'Resourcing Monthly Report', true, [
    ...h.pageTitle(t, 'Resourcing Monthly Report', 'Allocation, work summary and utilization review'),

    h.sectionTitle(t, 'Overview'),
    h.infoTable(t, [
      ['Project Name', o.project],
      ['Period', o.period],
      ['Total Resources', o.totalResources],
      ['Total Hours', o.totalHours],
      ['Report Prepared By', o.preparedBy],
    ]),

    h.sectionTitle(t, 'Resource Allocation'),
    h.dataTable(t,
      ['Resource', 'Role', 'Assigned Project', 'Status'],
      allocRows.length ? allocRows : Array(6).fill([
        '—', '—', '—', 'Active / Bench / On Leave',
      ]),
      { widths: ['*', 90, '*', 130] }
    ),

    h.sectionTitle(t, 'Work Summary'),
    h.dataTable(t,
      ['Resource', 'Tasks', 'Hours', 'Output'],
      workRows.length ? workRows : Array(5).fill([ '—', '—', '—', '—' ]),
      { widths: [90, '*', 60, '*'] }
    ),

    h.sectionTitle(t, 'Utilization Summary'),
    h.kvBullets([
      ['Average Utilization %', util.averagePct != null ? h.pct(util.averagePct, 1) : null],
      ['Overutilized (>110%)', (util.overutilized || []).join(', ')],
      ['Underutilized (<70%)', (util.underutilized || []).join(', ')],
    ]),

    h.sectionTitle(t, 'Key Highlights'),
    h.kvBullets([
      ['Achievements', hi.achievements],
      ['Issues', hi.issues],
      ['Plan for Next Month', hi.planNextMonth],
    ]),
  ]);
}

// ============================================================
// 13. Resource Utilization Report ----------------------------
// ============================================================
function resourceUtilization(d) {
  const t = BRAND.resourcing;
  const s = d.summary || {};
  const breakdown = d.breakdown || [];
  const insights = d.insights || {};

  const breakdownRows = breakdown.map(r => {
    const util = r.utilizationPct != null ? Number(r.utilizationPct) : c.utilizationPct(r.workedHours, r.availableHours);
    return [r.name || '—', r.availableHours != null ? r.availableHours : '—',
      r.workedHours != null ? r.workedHours : '—',
      isFinite(util) ? h.pct(util, 1) : '—'];
  });

  // Classification bands from breakdown
  let full = 0, mod = 0, low = 0;
  for (const r of breakdown) {
    const util = r.utilizationPct != null ? Number(r.utilizationPct) : c.utilizationPct(r.workedHours, r.availableHours);
    if (!isFinite(util)) continue;
    if (util > 90) full++;
    else if (util >= 60) mod++;
    else low++;
  }

  return scaffold(t, 'Resource Utilization', true, [
    ...h.pageTitle(t, 'Resource Utilization Report', 'Worked vs available hours with classification'),

    h.sectionTitle(t, 'Summary'),
    h.infoTable(t, [
      ['Reporting Period', s.period],
      ['Total Available Hours', s.totalAvailableHours],
      ['Total Worked Hours', s.totalWorkedHours],
      ['Utilization %', s.utilizationPct != null ? h.pct(s.utilizationPct, 1)
        : (s.totalAvailableHours ? h.pct(c.utilizationPct(s.totalWorkedHours, s.totalAvailableHours), 1) : null)],
    ]),

    h.sectionTitle(t, 'Resource Breakdown'),
    h.dataTable(t,
      ['Resource', 'Available (h)', 'Worked (h)', 'Utilization %'],
      breakdownRows.length ? breakdownRows : Array(8).fill([ '—', '—', '—', '—' ]),
      { widths: ['*', 90, 90, 100] }
    ),

    h.sectionTitle(t, 'Classification'),
    h.dataTable(t,
      ['Category', 'Count'],
      [
        ['Fully Utilized (>90%)', full || '—'],
        ['Moderate (60–90%)', mod || '—'],
        ['Low (<60%)', low || '—'],
      ],
      { widths: ['*', 120] }
    ),

    h.sectionTitle(t, 'Insights'),
    h.kvBullets([
      ['High Performers', (insights.highPerformers || []).join(', ')],
      ['Low Utilization', (insights.lowUtilization || []).join(', ')],
      ['Recommended Action', insights.recommendedAction],
    ]),
  ]);
}

// ============================================================
// 14. Resourcing KPI Report ----------------------------------
// ============================================================
function resourcingKpi(d) {
  const t = BRAND.resourcing;
  const rows = d.employees || [];
  const metrics = d.metrics || {};
  const ranking = d.ranking || [];
  const insights = d.insights || {};

  const empRows = rows.map(r => [
    r.name || '—',
    r.productivityPct != null ? h.pct(r.productivityPct, 1) : '—',
    r.utilizationPct != null ? h.pct(r.utilizationPct, 1) : '—',
    r.quality != null ? r.quality : '—',
    r.score != null ? r.score : '—',
  ]);

  const rankRows = ranking.length
    ? ranking.map((x, i) => [i + 1, x.name || '—', x.score != null ? x.score : '—'])
    : [1, 2, 3, 4, 5].map(i => [i, '—', '—']);

  return scaffold(t, 'Resourcing KPI', true, [
    ...h.pageTitle(t, 'Resourcing KPI Report', 'Productivity, Utilization & Quality scorecard per resource'),

    h.sectionTitle(t, 'Employee KPI'),
    h.dataTable(t,
      ['Resource', 'Productivity %', 'Utilization %', 'Quality', 'Score'],
      empRows.length ? empRows : Array(6).fill([ '—', '—', '—', '—', '—' ]),
      { widths: ['*', 100, 100, 80, 70] }
    ),

    h.sectionTitle(t, 'Metrics'),
    h.infoTable(t, [
      ['Avg Productivity', metrics.avgProductivity != null ? h.pct(metrics.avgProductivity, 1) : null],
      ['Avg Utilization', metrics.avgUtilization != null ? h.pct(metrics.avgUtilization, 1) : null],
      ['Quality Index', metrics.qualityIndex],
    ]),

    h.sectionTitle(t, 'Ranking'),
    h.dataTable(t,
      ['Rank', 'Resource', 'Score'],
      rankRows,
      { widths: [60, '*', 100] }
    ),

    h.sectionTitle(t, 'Insights'),
    h.kvBullets([
      ['Top Performers', (insights.topPerformers || []).join(', ')],
      ['Improvement Areas', insights.improvementAreas],
    ]),
  ]);
}

// ============================================================
// 15. Resource Variation Report ------------------------------
// ============================================================
function resourceVariation(d) {
  const t = BRAND.resourcing;
  const v = d.variation || {};
  const changes = d.changes || [];
  const cost = d.cost || {};
  const approval = d.approval || {};

  const changeRows = changes.map(x => {
    const diff = x.difference != null ? x.difference
      : (isFinite(Number(x.revisedHours)) && isFinite(Number(x.previousHours))
         ? Number(x.revisedHours) - Number(x.previousHours) : null);
    return [x.name || '—', x.previousHours != null ? x.previousHours : '—',
      x.revisedHours != null ? x.revisedHours : '—',
      diff != null ? (diff >= 0 ? '+' : '') + diff : '±—'];
  });

  const diffCost = cost.difference != null ? cost.difference
    : (isFinite(Number(cost.revisedCost)) && isFinite(Number(cost.previousCost))
       ? Number(cost.revisedCost) - Number(cost.previousCost) : null);

  return scaffold(t, 'Resource Variation', true, [
    ...h.pageTitle(t, 'Resource Variation Report', 'Resource change order with cost impact'),

    h.sectionTitle(t, 'Variation Details'),
    h.infoTable(t, [
      ['Project', v.project],
      ['Variation ID', v.id],
      ['Date Raised', v.dateRaised],
      ['Resource Change', v.resourceChange || 'Add / Remove / Swap / Extend'],
    ]),

    h.sectionTitle(t, 'Change Summary'),
    h.dataTable(t,
      ['Resource', 'Previous Hours', 'Revised Hours', 'Difference'],
      changeRows.length ? changeRows : Array(4).fill([ '—', '—', '—', '±—' ]),
      { widths: ['*', 110, 110, 110] }
    ),

    h.sectionTitle(t, 'Cost Impact'),
    h.dataTable(t,
      ['Description', 'Amount (AED)'],
      [
        ['Previous Cost', cost.previousCost != null ? h.money(cost.previousCost) : '—'],
        ['Revised Cost', cost.revisedCost != null ? h.money(cost.revisedCost) : '—'],
        ['Difference', diffCost != null ? (diffCost >= 0 ? '+' : '') + h.money(diffCost) : '±—'],
      ],
      { widths: ['*', 180] }
    ),

    h.sectionTitle(t, 'Approval'),
    h.kvBullets([
      ['Status', approval.status],
      ['Approved By', approval.approvedBy],
      ['Remarks', approval.remarks],
    ]),
  ]);
}

// ============================================================
// 16. Portfolio Resourcing Billing Summary -------------------
// ============================================================
function portfolioResourcingSummary(d) {
  const t = BRAND.resourcing;
  const o = d.overview || {};
  const projects = d.projects || [];
  const roles = d.roleDistribution || [];
  const insights = d.insights || {};

  const projRows = projects.map(p => [
    p.name || '—',
    p.resources != null ? p.resources : '—',
    p.hours != null ? p.hours : '—',
    p.billingAED != null ? h.money(p.billingAED) : '—',
  ]);
  const totalResources = projects.reduce((s, p) => s + (Number(p.resources) || 0), 0);
  const totalHours = projects.reduce((s, p) => s + (Number(p.hours) || 0), 0);
  const totalBilling = projects.reduce((s, p) => s + (Number(p.billingAED) || 0), 0);
  projRows.push([
    { text: 'Total', bold: true },
    { text: totalResources || '—', bold: true },
    { text: totalHours || '—', bold: true },
    { text: h.money(totalBilling), bold: true },
  ]);

  const roleRows = roles.map(r => [r.role || '—', r.count != null ? r.count : '—',
    r.utilizationPct != null ? h.pct(r.utilizationPct, 1) : '—']);

  return scaffold(t, 'Portfolio Resourcing Summary', true, [
    ...h.pageTitle(t, 'Portfolio Resourcing Billing Summary', 'Multi-project resource billing roll-up'),

    h.sectionTitle(t, 'Overview'),
    h.infoTable(t, [
      ['Reporting Period', o.period],
      ['Total Projects', o.totalProjects != null ? o.totalProjects : projects.length],
      ['Total Resources', o.totalResources != null ? o.totalResources : totalResources],
      ['Total Hours', o.totalHours != null ? o.totalHours : totalHours],
      ['Total Billing (AED)', o.totalBilling != null ? h.money(o.totalBilling) : h.money(totalBilling)],
    ]),

    h.sectionTitle(t, 'Project Breakdown'),
    h.dataTable(t,
      ['Project', 'Resources', 'Hours', 'Billing (AED)'],
      projRows,
      { widths: ['*', 90, 90, 120] }
    ),

    h.sectionTitle(t, 'Resource Distribution'),
    h.dataTable(t,
      ['Role', 'Count', 'Utilization %'],
      roleRows.length ? roleRows : Array(5).fill([ '—', '—', '—' ]),
      { widths: ['*', 100, 120] }
    ),

    h.sectionTitle(t, 'Insights'),
    h.kvBullets([
      ['High Billing Projects', (insights.highBillingProjects || []).join(', ')],
      ['Low Utilization Projects', (insights.lowUtilizationProjects || []).join(', ')],
      ['Recommended Action', insights.recommendedAction],
    ]),
  ]);
}


// ============================================================
// 17. IPA — AFE / Lump-Sum Style  (e.g. Golf Hills / AFE Contracting)
// ============================================================
// Expected data shape:
// {
//   ipa: { no, date, client, project, contractValue, preparedBy:{nameRole,date}, approvedBy:{nameRole,date} },
//   itemA: { label:'MEP Works', components:[{name, contractValue, cumPrev, thisApp},...] },
//   itemB: { label:'Architectural Works', components:[...] },
//   itemC: { label:'On-Site Co-ordinator', contractValue, cumPrev, thisApp },
//   deductions: { certifiedAdvance, retention, retentionReleased, other }
// }
function ipaAfe(d) {
  const t = BRAND.lumpSum;
  const ipa  = d.ipa  || {};
  const deds = d.deductions || {};

  // ── helper: build component rows for one discipline ──────────────────────────
  function componentRows(item) {
    if (!item || !item.components || !item.components.length) return [];
    return item.components.map(comp => {
      const cv   = comp.contractValue  != null ? Number(comp.contractValue)  : NaN;
      const prev = comp.cumPrev        != null ? Number(comp.cumPrev)        : NaN;
      const app  = comp.thisApp        != null ? Number(comp.thisApp)        : NaN;
      const cumThis = isFinite(prev) && isFinite(app) ? prev + app : NaN;
      const pct  = isFinite(cumThis) && isFinite(cv) && cv !== 0
                      ? (cumThis / cv) * 100 : NaN;
      return [
        { text: '   ' + (comp.name || '—'), fontSize: 9 },
        { text: isFinite(cv)      ? h.money(cv)      : '—', align: 'right' },
        { text: isFinite(prev)    ? h.money(prev)    : '—', align: 'right' },
        { text: isFinite(app)     ? h.money(app)     : '—', align: 'right' },
        { text: isFinite(cumThis) ? h.money(cumThis) : '—', align: 'right' },
        { text: isFinite(pct)     ? h.pct(pct, 1)   : '—', align: 'right' },
      ];
    });
  }

  // ── subtotal row for one discipline ──────────────────────────────────────────
  function subtotalRow(item, label) {
    const comps = (item && item.components) ? item.components : [];
    const cv    = comps.reduce((s, c) => s + (Number(c.contractValue) || 0), 0);
    const prev  = comps.reduce((s, c) => s + (Number(c.cumPrev)       || 0), 0);
    const app   = comps.reduce((s, c) => s + (Number(c.thisApp)       || 0), 0);
    const cumThis = prev + app;
    const pct   = cv ? (cumThis / cv) * 100 : NaN;
    return [
      { text: label, bold: true },
      { text: h.money(cv),       bold: true, align: 'right' },
      { text: h.money(prev),     bold: true, align: 'right' },
      { text: h.money(app),      bold: true, align: 'right' },
      { text: h.money(cumThis),  bold: true, align: 'right' },
      { text: isFinite(pct) ? h.pct(pct, 1) : '—', bold: true, align: 'right' },
    ];
  }

  // ── Item C: single-line ───────────────────────────────────────────────────────
  const itemC = d.itemC || {};
  const cCV   = Number(itemC.contractValue) || 0;
  const cPrev = Number(itemC.cumPrev)       || 0;
  const cApp  = Number(itemC.thisApp)       || 0;
  const cCum  = cPrev + cApp;
  const cPct  = cCV ? (cCum / cCV) * 100 : NaN;

  const rowC = [
    { text: itemC.label || 'On-Site Co-ordinator', bold: true },
    { text: h.money(cCV),  bold: true, align: 'right' },
    { text: h.money(cPrev),bold: true, align: 'right' },
    { text: h.money(cApp), bold: true, align: 'right' },
    { text: h.money(cCum), bold: true, align: 'right' },
    { text: isFinite(cPct) ? h.pct(cPct, 1) : '—', bold: true, align: 'right' },
  ];

  // ── Item D: sub-total ─────────────────────────────────────────────────────────
  function itemSum(item) {
    return (item && item.components ? item.components : [])
      .reduce((acc, c) => ({
        cv:   acc.cv   + (Number(c.contractValue) || 0),
        prev: acc.prev + (Number(c.cumPrev)       || 0),
        app:  acc.app  + (Number(c.thisApp)       || 0),
      }), { cv: 0, prev: 0, app: 0 });
  }
  const sA = itemSum(d.itemA);
  const sB = itemSum(d.itemB);
  const dCV   = sA.cv   + sB.cv   + cCV;
  const dPrev = sA.prev + sB.prev + cPrev;
  const dApp  = sA.app  + sB.app  + cApp;
  const dCum  = dPrev + dApp;
  const dPct  = dCV ? (dCum / dCV) * 100 : NaN;

  const rowD = [
    { text: 'D  Sub-Total  (A + B + C)', bold: true, fillColor: BRAND.lumpSum.labelBg },
    { text: h.money(dCV),  bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg },
    { text: h.money(dPrev),bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg },
    { text: h.money(dApp), bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg },
    { text: h.money(dCum), bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg },
    { text: isFinite(dPct) ? h.pct(dPct, 1) : '—', bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg },
  ];

  // ── Deduction rows ─────────────────────────────────────────────────────────────
  const certAdv  = Number(deds.certifiedAdvance)   || 0;
  const ret      = Number(deds.retention)          || (dCum ? dCum * 0.05 : 0);
  const retRel   = Number(deds.retentionReleased)  || 0;
  const other    = Number(deds.other)              || 0;
  const totalDed = certAdv + ret - retRel + other;
  const netPay   = dApp - totalDed;

  function dedRow(letter, label, val, isNeg) {
    return [
      { text: letter + '  ' + label },
      '', '', { text: isNeg ? '(' + h.money(Math.abs(val)) + ')' : h.money(val), align: 'right' }, '', '',
    ];
  }

  const dedRows = [
    dedRow('E', (deds.certifiedAdvanceLabel || 'Certified / Advance Payment'), certAdv, false),
    dedRow('F', 'Retention (5%)',              ret,    false),
    dedRow('G', 'Less: Retention Released',    retRel, true),
    dedRow('H', (deds.otherLabel || 'Other Deductions'), other, false),
    [
      { text: 'I  Total Deductions  (E + F − G + H)', bold: true, fillColor: BRAND.lumpSum.labelBg },
      '', '', { text: h.money(totalDed), bold: true, align: 'right', fillColor: BRAND.lumpSum.labelBg }, '', '',
    ],
    [
      { text: 'J  Net Payment  (D − I)', bold: true, fillColor: '#D1FAE5', color: '#065F46' },
      '', '', { text: h.money(netPay), bold: true, align: 'right', fillColor: '#D1FAE5', color: '#065F46' }, '', '',
    ],
  ];

  // ── Assemble rows ─────────────────────────────────────────────────────────────
  const HEADERS = ['Description', 'Contract Value (AED)', 'Cum. to Last Claim (AED)', 'This Application (AED)', 'Cum. to This Claim (AED)', '% Complete'];
  const WIDTHS  = ['*', 100, 100, 100, 100, 70];

  const allRows = [
    // Item A header
    [{ text: 'A  ' + ((d.itemA && d.itemA.label) || 'MEP Works'), bold: true, colSpan: 6 }, '', '', '', '', ''],
    ...componentRows(d.itemA),
    subtotalRow(d.itemA, 'A  ' + ((d.itemA && d.itemA.label) || 'MEP Works') + ' — Total'),
    // Item B header
    [{ text: 'B  ' + ((d.itemB && d.itemB.label) || 'Architectural Works'), bold: true, colSpan: 6 }, '', '', '', '', ''],
    ...componentRows(d.itemB),
    subtotalRow(d.itemB, 'B  ' + ((d.itemB && d.itemB.label) || 'Architectural Works') + ' — Total'),
    // Item C
    rowC,
    // Item D
    rowD,
    // Deductions
    ...dedRows,
  ];

  // ── Build pdfmake table ───────────────────────────────────────────────────────
  const headCells = HEADERS.map(hh => ({
    text: hh, bold: true,
    color: BRAND.lumpSum.tableHeadText,
    fillColor: BRAND.lumpSum.tableHead,
    margin: [4, 5, 4, 5], fontSize: 8.5,
    alignment: hh === 'Description' ? 'left' : 'right',
  }));

  const bodyRows = allRows.map(row =>
    row.map((cell, ci) => {
      if (cell === '') return { text: '', margin: [4, 4, 4, 4], fontSize: 9 };
      if (typeof cell === 'object' && 'text' in cell) {
        return Object.assign({
          margin: [4, 4, 4, 4], fontSize: 9,
          alignment: cell.align || (ci === 0 ? 'left' : 'right'),
        }, cell);
      }
      return { text: h.fmt(cell), margin: [4, 4, 4, 4], fontSize: 9, alignment: ci === 0 ? 'left' : 'right' };
    })
  );

  return scaffold(t, 'IPA', false, [
    ...h.pageTitle(t, 'Interim Payment Application', 'Joseph Engineering Services — AFE Style'),

    h.sectionTitle(t, 'Application Details'),
    h.infoTable(t, [
      ['IPA Reference No',  ipa.no       || ''],
      ['Date',              ipa.date     || ''],
      ['Client',            ipa.client   || ''],
      ['Project',           ipa.project  || ''],
      ['Contract Value',    ipa.contractValue ? h.money(ipa.contractValue) : ''],
    ]),

    h.sectionTitle(t, 'Payment Breakdown'),
    {
      margin: [0, 0, 0, 4],
      table: { headerRows: 1, widths: WIDTHS, body: [headCells, ...bodyRows] },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#CBD5E1',
        vLineColor: () => '#CBD5E1',
        paddingTop:    () => 0,
        paddingBottom: () => 0,
        paddingLeft:   () => 0,
        paddingRight:  () => 0,
      },
    },

    h.sectionTitle(t, 'Amount in Words'),
    {
      margin: [0, 0, 0, 10],
      table: {
        widths: [120, '*'],
        body: [[
          { text: 'Net Payment (Words):', bold: true, fillColor: BRAND.lumpSum.labelBg, margin: [6, 6, 6, 6], fontSize: 9.5 },
          { text: h.fmt(d.amountInWords) || '< Amount in words >', margin: [6, 6, 6, 6], fontSize: 9.5 },
        ]],
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#CBD5E1', vLineColor: () => '#CBD5E1', paddingTop: () => 0, paddingBottom: () => 0, paddingLeft: () => 0, paddingRight: () => 0 },
    },

    h.signatureBlock(t, ipa.preparedBy || {}, ipa.approvedBy || {}),
  ]);
}

// ============================================================
// 18. IPA — AlTayer / Completion-Percentage Style (e.g. Orla Towers)
// ============================================================
// Expected data shape:
// {
//   ipa: { no, date, client, project, contractValue, advancePct,
//          preparedBy:{nameRole,date}, approvedBy:{nameRole,date} },
//   itemA: { label:'Project Completion', completionPct },   // AED = completionPct% × contractValue
//   itemB: { label:'On-Site Co-ordinator', amount },
//   itemC: { label:'Additional Scope / Sky Palace', amount },
//   deductions: { advancePct, retention, retentionReleased, other }
// }
function ipaAlTayer(d) {
  const t   = BRAND.lumpSum;
  const ipa = d.ipa || {};
  const deds = d.deductions || {};

  const contractValue = Number(ipa.contractValue) || 0;
  const advancePct    = Number(ipa.advancePct || deds.advancePct) || 0;

  // ── Item A: Project Completion ────────────────────────────────────────────────
  const itemA = d.itemA || {};
  const compPct   = Number(itemA.completionPct) || 0;
  const itemAmt_A = contractValue ? (compPct / 100) * contractValue : (Number(itemA.amount) || 0);

  // ── Item B: On-Site Co-ordinator ──────────────────────────────────────────────
  const itemB    = d.itemB || {};
  const itemAmt_B = Number(itemB.amount) || 0;

  // ── Item C: Additional Scope ──────────────────────────────────────────────────
  const itemC    = d.itemC || {};
  const itemAmt_C = Number(itemC.amount) || 0;

  // ── Item D: Sub-Total ─────────────────────────────────────────────────────────
  const itemD = itemAmt_A + itemAmt_B + itemAmt_C;

  // ── Item E: Less Advance Payment ──────────────────────────────────────────────
  const advanceDeduct = advancePct ? (advancePct / 100) * itemD : (Number(deds.advanceAmount) || 0);

  // ── Remaining deductions ──────────────────────────────────────────────────────
  const ret     = Number(deds.retention)         || (itemD ? itemD * 0.05 : 0);
  const retRel  = Number(deds.retentionReleased) || 0;
  const other   = Number(deds.other)             || 0;
  const totalDed = advanceDeduct + ret - retRel + other;
  const netPay  = itemD - totalDed;

  // ── Breakdown table rows ──────────────────────────────────────────────────────
  function itemRow(letter, label, amount, isBold, bgColor) {
    const fill = bgColor || undefined;
    return [
      { text: letter + '  ' + label, bold: !!isBold, fillColor: fill },
      { text: h.money(amount), bold: !!isBold, alignment: 'right', fillColor: fill },
    ];
  }

  const HEADERS2  = ['Item', 'Amount (AED)'];
  const WIDTHS2   = ['*', 160];

  const headCells2 = HEADERS2.map(hh => ({
    text: hh, bold: true,
    color: BRAND.lumpSum.tableHeadText,
    fillColor: BRAND.lumpSum.tableHead,
    margin: [6, 6, 6, 6], fontSize: 9.5,
  }));

  const tableRows = [
    itemRow('A', (itemA.label || 'Project Completion') + (compPct ? '  (' + h.pct(compPct, 1) + ' × Contract Value)' : ''), itemAmt_A),
    itemRow('B', itemB.label || 'On-Site Co-ordinator',   itemAmt_B),
    itemRow('C', itemC.label || 'Additional Scope',        itemAmt_C),
    itemRow('D', 'Sub-Total  (A + B + C)',                  itemD, true, BRAND.lumpSum.labelBg),
    itemRow('E', 'Less: Advance Payment' + (advancePct ? '  (' + h.pct(advancePct, 1) + ' × D)' : ''), advanceDeduct),
    itemRow('F', 'Retention (5%)',                          ret),
    itemRow('G', 'Less: Retention Released',               retRel),
    itemRow('H', deds.otherLabel || 'Other Deductions',     other),
    itemRow('I', 'Total Deductions  (E + F − G + H)',       totalDed, true, BRAND.lumpSum.labelBg),
    [
      { text: 'J  Net Payment  (D − I)', bold: true, fillColor: '#D1FAE5', color: '#065F46', margin: [6, 6, 6, 6], fontSize: 9.5 },
      { text: h.money(netPay), bold: true, alignment: 'right', fillColor: '#D1FAE5', color: '#065F46', margin: [6, 6, 6, 6], fontSize: 9.5 },
    ],
  ];

  const bodyRows2 = tableRows.map(row =>
    row.map(cell => Object.assign({ margin: [6, 5, 6, 5], fontSize: 9.5 }, cell))
  );

  const gridLayout = {
    hLineWidth: () => 0.5, vLineWidth: () => 0.5,
    hLineColor: () => '#CBD5E1', vLineColor: () => '#CBD5E1',
    paddingTop: () => 0, paddingBottom: () => 0,
    paddingLeft: () => 0, paddingRight: () => 0,
  };

  return scaffold(t, 'IPA', false, [
    ...h.pageTitle(t, 'Interim Payment Application', 'Joseph Engineering Services — AlTayer Style'),

    h.sectionTitle(t, 'Application Details'),
    h.infoTable(t, [
      ['IPA Reference No',    ipa.no              || ''],
      ['Date',                ipa.date            || ''],
      ['Client',              ipa.client          || ''],
      ['Project',             ipa.project         || ''],
      ['Contract Value (AED)', contractValue ? h.money(contractValue) : ''],
      ['Advance Payment %',   advancePct ? h.pct(advancePct, 1) : '—'],
    ]),

    h.sectionTitle(t, 'Payment Breakdown'),
    {
      margin: [0, 0, 0, 4],
      table: { headerRows: 1, widths: WIDTHS2, body: [headCells2, ...bodyRows2] },
      layout: gridLayout,
    },

    h.sectionTitle(t, 'Amount in Words'),
    {
      margin: [0, 0, 0, 10],
      table: {
        widths: [120, '*'],
        body: [[
          { text: 'Net Payment (Words):', bold: true, fillColor: BRAND.lumpSum.labelBg, margin: [6, 6, 6, 6], fontSize: 9.5 },
          { text: h.fmt(d.amountInWords) || '< Amount in words >', margin: [6, 6, 6, 6], fontSize: 9.5 },
        ]],
      },
      layout: gridLayout,
    },

    h.signatureBlock(t, ipa.preparedBy || {}, ipa.approvedBy || {}),
  ]);
}

module.exports = { build, list, REGISTRY };

