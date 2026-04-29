const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// ── Airtable config ────────────────────────────────────────────────────────────
const AIRTABLE_BASE      = 'appv03uy1Q2j8h84L';
const AT_PROJECTS_TABLE  = 'tblv43i5fJdEvg1Kh';  // DB-A Projects Master
const AT_RESOURCES_TABLE = 'tbl01L40SjaF0qb4E';  // DB-B People & Resources
const AT_INVOICES_TABLE  = 'tblavw5HFAVJ5H4HF';  // DB-8 Commercial Invoicing
const AT_MANMONTHS_TABLE = 'tbl0mrD1Ex5sIDuC2';  // DB-9 Manmonth Tracker

// ── Auth ──────────────────────────────────────────────────────────────────────
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── Project name aliases for fuzzy matching ───────────────────────────────────
const PROJECT_ALIASES = {
  'wph': 'WPH KSA',
  'wph ksa': 'WPH KSA',
  'ksa': 'WPH KSA',
  'riyadh': 'WPH KSA',
  'golf': 'Golf Hillside',
  'golf hill': 'Golf Hillside',
  'golf hillside': 'Golf Hillside',
  'top golf': 'Top Golf',
  'topgolf': 'Top Golf',
  'ot': 'OT Sky Palace',
  'ot sky': 'OT Sky Palace',
  'sky palace': 'OT Sky Palace',
  'orla': 'Orla Towers',
  'orla towers': 'Orla Towers',
  'abaad': 'Abaad Wood — The Grove Ph.02',
  'abaad wood': 'Abaad Wood — The Grove Ph.02',
  'grove': 'Abaad Wood — The Grove Ph.02',
  'al badia': 'Al-Badia Phase 6',
  'al-badia': 'Al-Badia Phase 6',
  'albadia': 'Al-Badia Phase 6',
  'badia': 'Al-Badia Phase 6',
  'dar': 'DAR — Al Maktoum International Airport',
  'maktoum': 'DAR — Al Maktoum International Airport',
  'airport': 'DAR — Al Maktoum International Airport',
  'h2r': 'H2R — Maison Margiela Residence',
  'maison': 'H2R — Maison Margiela Residence',
  'margiela': 'H2R — Maison Margiela Residence',
  'alemco': 'ALEMCO',
  'wynn': 'ALEMCO — Wynn Al Marjan Island',
  'marjan': 'ALEMCO — Wynn Al Marjan Island',
  'data centre': 'ALEMCO — Data Centre',
  'data center': 'ALEMCO — Data Centre',
  'data centre': 'ALEMCO — Data Centre',
  'dc': 'ALEMCO — Data Centre',
  'admin': 'ALEMCO — Admin Building',
  'admin bldg': 'ALEMCO — Admin Building',
  'metro': 'MNG — Metro Project',
  'metro project': 'MNG — Metro Project',
  'mng': 'MNG — Metro Project',
  'wai': 'WAI — Dan Al Ahsa',
  'dan al ahsa': 'WAI — Dan Al Ahsa',
  'ahsa': 'WAI — Dan Al Ahsa',
  'bendito': 'Bendito — Masdar City',
  'masdar': 'Bendito — Masdar City',
  'masdar city': 'Bendito — Masdar City',
  'asgc': 'ASGC — MAA 1&2 Blockwork',
  'maa': 'ASGC — MAA 1&2 Blockwork',
  'blockwork': 'ASGC — MAA 1&2 Blockwork',
  'wooden flooring': 'ASGC — MAA 1&2 Wooden Flooring',
  'ikk': 'IKK — The Grove Expansion Joint',
  'expansion joint': 'IKK — The Grove Expansion Joint',
  'innovo': 'INNOVO — Beach Mansion',
  'beach mansion': 'INNOVO — Beach Mansion',
  'creek edge': 'ASGC — Creek Edge',
  'alec': 'ALEC — RSMLI',
  'rsmli': 'ALEC — RSMLI',
};

// ── Smart intent detection ─────────────────────────────────────────────────────
function detectIntent(message) {
  const m = message.toLowerCase();

  // Report intent
  const isReport = /\b(report|generate report|create report|make report|export|download|full report|status report|kpi report|project report|man.?month report|portfolio report)\b/.test(m);
  const isExcel  = /\b(excel|spreadsheet|xlsx|xls)\b/.test(m);

  // Billing model filter
  const billingModel = (m.includes('lump sum') || m.includes('lumpsum')) ? 'Lump Sum'
    : m.includes('resourc') ? 'Resourcing' : null;

  // Find mentioned project via aliases
  let mentionedProject = null;
  let longestMatch = 0;
  for (const [alias, projectName] of Object.entries(PROJECT_ALIASES)) {
    if (m.includes(alias) && alias.length > longestMatch) {
      longestMatch = alias.length;
      mentionedProject = projectName;
    }
  }

  // Query type classification
  const isRiskQuery     = /\b(risk|at risk|critical|over budget|overrun|behind|delay|alert|warning|concern)\b/.test(m);
  const isTeamQuery     = /\b(team|staff|resource|people|headcount|who is|who are|member|modeler|coordinator|designation|name|arch team|mep team|resource list|who work|assigned|bench|available|unassigned|free|idle|inactive)\b/.test(m);
  const isProgressQuery = /\b(progress|status|how far|completion|percent|%|complete)\b/.test(m);
  const isMMQuery       = /\b(man.?month|mm|budget|utilis|utiliz|burn|spend)\b/.test(m);
  const isPortfolioQuery= /\b(portfolio|all project|overview|summary|total|overall)\b/.test(m);
  const isCompareQuery  = /\b(compare|vs|versus|difference|which is|best|worst|highest|lowest|top|bottom)\b/.test(m);
  const isBillingQuery  = /\b(invoice|invoic|billing|bill|payment|paid|claim|progress claim|commercial|revenue|aed|contract value|milestone payment|approval payment|receivable|money|collect|how much|outstanding|collected|pending payment|pa-|inv-)\b/.test(m);

  // NEW — Notion-backed queries
  const isDeliverableQuery = /\b(drawing|drawings|deliverable|submission|submitted|approved|lod|package)\b/.test(m);
  const isScheduleQuery    = /\b(schedule|milestone|deadline|due|planned date|calendar)\b/.test(m);
  const isRfiQuery         = /\b(rfi|issue|clash|query|question raised)\b/.test(m);
  const isInputQuery       = /\b(input|prerequisite|blocking|blocker|waiting for|pending input|missing input)\b/.test(m);
  const isCommsQuery       = /\b(communication|email|correspondence|meeting minutes|submission log|reply)\b/.test(m);
  const isDocQuery         = /\b(document|doc register|spec|specification|contract doc|drawing register)\b/.test(m);
  const isModelQuery       = /\b(model update|revit model|model revision|model log)\b/.test(m);
  const isVariationQuery   = /\b(variation|change order|scope change|extra work|vo |vc )\b/.test(m);
  const isKpiQuery         = /\b(kpi|performance|efficiency|productivity|rating|attendance|score)\b/.test(m);
  const isTimesheetQuery   = /\b(timesheet|hours worked|time log|time sheet|time entry)\b/.test(m);

  return {
    isReport, isExcel, billingModel, mentionedProject,
    isRiskQuery, isTeamQuery, isProgressQuery, isMMQuery,
    isPortfolioQuery, isCompareQuery, isBillingQuery,
    isDeliverableQuery, isScheduleQuery, isRfiQuery, isInputQuery,
    isCommsQuery, isDocQuery, isModelQuery, isVariationQuery,
    isKpiQuery, isTimesheetQuery,
    rawMessage: message,
  };
}

// ── Airtable helpers ──────────────────────────────────────────────────────────
async function fetchAirtableRecords(tableId) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}?pageSize=100`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.records || [];
  } catch { return null; }
}

// ── Resource data: Notion Resource Tracker (primary) → local JSON (fallback) ──
// ── Notion resource tracker ────────────────────────────────────────────────────
const { Client: NotionClient } = require('@notionhq/client');
const notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
const notionDbs = require('./data/_notionDbs');
const RESOURCE_TRACKER_DB = process.env.NOTION_RESOURCE_TRACKER_DB || 'eaf583f113034aababf8bf13cf4ac250';

function mapNotionResource(page) {
  const p = page.properties;
  const sel  = k => p[k]?.select?.name || null;
  const txt  = k => (p[k]?.rich_text || [])[0]?.plain_text || '';
  const titl = k => (p[k]?.title || [])[0]?.plain_text || '';

  const discipline = sel('Discipline') || '';
  const isArch     = discipline === 'Architecture';
  const discType   = isArch ? null : discipline.replace('MEP - ', '');
  const designation = sel('Designation') || '';
  const gradeMap = {
    'Project Manager': 'Projects Manager', 'BIM Lead': 'BIM Lead',
    'BIM Coordinator': 'BIM Coordinator',  'Sr. BIM Modeler': 'Senior BIM Modeler',
    'BIM Modeler': 'BIM Modeler',          'Jr. BIM Modeler': 'Junior BIM Modeler',
    'Intern': 'Intern',
  };
  const isBench = (txt('Last Project') || '').toLowerCase() === 'internal' ||
                  sel('Reason') === 'Bench - Available';
  return {
    name:             titl('Employee Name'),
    designation,
    grade:            gradeMap[designation] || designation,
    discipline:       isArch ? 'Arch' : 'MEP',
    discipline_type:  discType,
    // use Department as team grouping for Arch (Architecture → "Architecture team")
    team:             sel('Department') || (isArch ? 'Architecture' : discType || 'MEP'),
    location:         sel('Location') || 'Chennai',
    current_project:  isBench ? 'Internal' : (txt('Last Project') || 'Unassigned'),
    status:           sel('Status') || 'Active',
    reason:           sel('Reason') || '',
    is_bench:         isBench,
  };
}

async function fetchFromNotionTracker() {
  const all = [];
  let cursor;
  do {
    const resp = await notionClient.databases.query({
      database_id: RESOURCE_TRACKER_DB,
      page_size: 100,
      start_cursor: cursor,
      filter: { property: 'Status', select: { does_not_equal: 'Terminated' } },
    });
    resp.results.forEach(pg => {
      const r = mapNotionResource(pg);
      if (r.name) all.push(r);
    });
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return all;
}

async function fetchResources() {
  let arch = [], mep = [];

  // ── PRIMARY: local resources_data.json (rebuilt from Google Sheets April 2026) ─
  try {
    const dataPath = path.join(process.cwd(), 'public', 'resources_data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    arch = data.arch_resources || [];
    mep  = data.mep_resources  || [];
  } catch (localErr) {
    // ── FALLBACK: Notion Resource Active & Inactive Tracker ──────────────────────
    console.warn('Local JSON failed, using Notion:', localErr.message);
    try {
      const all = await fetchFromNotionTracker();
      arch = all.filter(r => r.discipline === 'Arch');
      mep  = all.filter(r => r.discipline === 'MEP');
    } catch { /* silent */ }
  }

  return { arch, mep, all: [...arch, ...mep] };
}

// ── Build resource context string ─────────────────────────────────────────────
function buildResourceContext(resources, intent) {
  const { arch, mep, all } = resources;
  const m = (intent.rawMessage || '').toLowerCase();

  // Bench / available resources query
  if (/\b(bench|available|unassigned|free|idle|not.*project|no.*project)\b/.test(m)) {
    const benchStaff = all.filter(r =>
      r.is_bench || (r.current_project || '').toLowerCase() === 'internal' ||
      r.reason === 'Bench - Available'
    );
    let ctx = `\n## BENCH RESOURCES (${benchStaff.length} available)\n`;
    if (benchStaff.length === 0) {
      ctx += 'No resources currently on bench — everyone is assigned to a project.\n';
    } else {
      ctx += `| Name | Discipline | Grade | Location |\n|---|---|---|---|\n`;
      benchStaff.forEach(r => {
        const disc = r.discipline === 'MEP' ? `MEP (${r.discipline_type || ''})` : 'Arch';
        ctx += `| ${r.name} | ${disc} | ${r.grade || r.designation || ''} | ${r.location || 'Chennai'} |\n`;
      });
    }
    return ctx;
  }

  // Project-specific resource query
  if (intent.mentionedProject) {
    const projectName = intent.mentionedProject.toLowerCase();
    const onProject = all.filter(r =>
      (r.current_project || '').toLowerCase().includes(projectName) ||
      (r.current_project || '').toLowerCase().includes(projectName.split('—')[0].trim())
    );
    if (onProject.length > 0) {
      let ctx = `\n## TEAM ON ${intent.mentionedProject.toUpperCase()}\n`;
      ctx += `| Name | Discipline | Grade | Location |\n|---|---|---|---|\n`;
      onProject.forEach(r => {
        const loc = r.location || (r.discipline === 'MEP' ? 'Chennai' : 'Chennai');
        const disc = r.discipline === 'MEP' ? `MEP (${r.discipline_type || ''})` : 'Arch';
        ctx += `| ${r.name} | ${disc} | ${r.grade || r.designation || ''} | ${loc} |\n`;
      });
      return ctx;
    }
  }

  // Team/headcount query
  const totalArch = arch.length;
  const totalMEP = mep.length;
  const archChennai = arch.filter(r => r.location === 'Chennai').length;
  const archTrichy = arch.filter(r => r.location === 'Trichy').length;
  const mepTrichy = mep.filter(r => r.location === 'Trichy').length;

  let ctx = `\n## RESOURCE SUMMARY (${all.length} total)\n`;
  ctx += `| | Arch | MEP | Total |\n|---|---|---|---|\n`;
  ctx += `| Total | ${totalArch} | ${totalMEP} | ${all.length} |\n`;
  ctx += `| Chennai | ${archChennai} | ${totalMEP - mepTrichy} | ${archChennai + totalMEP - mepTrichy} |\n`;
  ctx += `| Trichy | ${archTrichy} | ${mepTrichy} | ${archTrichy + mepTrichy} |\n\n`;

  ctx += `### Arch Teams\n`;
  const archTeams = [...new Set(arch.map(r => r.team))];
  archTeams.forEach(team => {
    const members = arch.filter(r => r.team === team);
    ctx += `**${team}** (${members.length}): `;
    ctx += members.map(r => `${r.name} — ${r.grade || r.designation || ''}`).join(', ') + '\n';
  });

  ctx += `\n### MEP Team (${mep.length} resources)\n`;
  ctx += `| Name | Type | Grade | Current Project |\n|---|---|---|---|\n`;
  mep.forEach(r => {
    ctx += `| ${r.name} | ${r.discipline_type || 'MEP'} | ${r.grade || r.designation || ''} | ${r.current_project} |\n`;
  });

  return ctx;
}

// ── Load projects: local JSON metrics + Airtable master field overrides ────────
async function fetchProjects(billingModelFilter) {
  // Step 1: Load base metrics from local JSON (progress, MM, files, etc.)
  let projects = [];
  try {
    const dataPath = path.join(process.cwd(), 'public', 'projects_data.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);
    projects = data.projects.map(p => ({
      name:              p.name,
      code:              p.code,
      billingModel:      p.billing_model,
      status:            p.status,
      stage:             p.stage,
      progress:          p.progress,
      client:            p.client,
      location:          p.location,
      teamSize:          p.team_size,
      disciplines:       p.disciplines || [],
      contractValue:        p.contract_value,
      manmonthsBudgeted:    p.manmonths_budgeted,
      manmonthsUsed:        p.manmonths_used,
      totalFiles:           p.total_files,
      scope:                p.scope,
      claimPct:             p.claim_pct || null,
      claimValueForecast:   p.claim_value_forecast || null,
      monthlyRatePerResource: p.monthly_rate_per_resource || null,
      riskFlags:            p.risk_flags || [],
      milestones:           p.milestones || null,
    }));
  } catch (e) {
    console.error('Could not read local projects JSON:', e.message);
  }

  // Step 2: Merge Airtable master fields (editable SSOT: name, status, scope, billing)
  const atRecords = await fetchAirtableRecords(AT_PROJECTS_TABLE);
  if (atRecords && atRecords.length > 0) {
    // Build lookup by Project_Code
    const atByCode = {};
    atRecords.forEach(r => {
      const code = (r.fields.Project_Code || '').trim();
      if (code) atByCode[code] = r.fields;
    });
    projects = projects.map(p => {
      const at = atByCode[p.code];
      if (!at) return p;
      return {
        ...p,
        name:         at.Project_Name    || p.name,
        status:       at.Status          || p.status,
        billingModel: at.Billing_Model   || p.billingModel,
        scope:        at.Scope_Description || p.scope,
        // Metrics (progress, MM, files) remain from local JSON extraction
      };
    });
  }

  if (billingModelFilter) {
    projects = projects.filter(p => p.billingModel === billingModelFilter);
  }
  return projects;
}

// ── Fetch commercial data from Airtable DB-8 (Invoices) + DB-9 (Manmonths) ────
async function fetchCommercialData() {
  const [invoiceRecords, mmRecords] = await Promise.all([
    fetchAirtableRecords(AT_INVOICES_TABLE),
    fetchAirtableRecords(AT_MANMONTHS_TABLE)
  ]);

  const invoices = (invoiceRecords || []).map(r => {
    const f = r.fields;
    const projectLinks = f['fldGTlvJRE9upF9dW'] || [];
    return {
      id:          f['fldgBJZKnNgY0ouZt'] || '',
      projectCode: (projectLinks[0] || {}).name || '',
      type:        (f['fld3d05bhpnmwIus5'] || {}).name || '',
      amount:      f['fldhdo1Hxzfw7JKuN'] || 0,
      period:      f['fldSDaMyKae8GHBFf'] || '',
      date:        f['fldetUS2ClmZpGvyD'] || '',
      status:      (f['fldfPXONrSpEfkSrP'] || {}).name || '',
      billingType: (f['fld2ODg0mrULpm6Dh'] || {}).name || '',
    };
  });

  const MONTH_ORDER = {
    'December 2025': 1, 'January 2026': 2, 'February 2026': 3,
    'March 2026': 4, 'April 2026': 5, 'May 2026': 6
  };
  const manmonths = (mmRecords || []).map(r => {
    const f = r.fields;
    const projectLinks = f['fldUvz91a5vIQD9gD'] || [];
    return {
      id:          f['fld7nGx0o9TjB5zIG'] || '',
      projectCode: (projectLinks[0] || {}).name || '',
      period:      f['fldshvxP4qzBRTX26'] || '',
      planned:     f['fldGBunjjH84pJaoH'] || 0,
      actual:      f['fldYrCFwVsS9O7d2D'] || 0,
      variance:    f['fldacfTDC36GX9wDo'] || 0,
      notes:       f['fldfRxl3d3OKZPZEb'] || '',
    };
  }).sort((a, b) => (MONTH_ORDER[a.period] || 99) - (MONTH_ORDER[b.period] || 99));

  return { invoices, manmonths };
}

// ── Build commercial context string ───────────────────────────────────────────
function buildCommercialContext(commercial, intent) {
  if (!commercial) return '';
  const { invoices, manmonths } = commercial;
  if (!invoices.length && !manmonths.length) return '';

  // Project filter: if a specific project is mentioned, show only its data
  const projFilter = intent.mentionedProject
    ? item => {
        const code = (item.projectCode || '').toUpperCase();
        const proj = (intent.mentionedProject || '').toUpperCase();
        return code.includes(proj.substring(0, 6)) || proj.includes(code.substring(0, 6));
      }
    : () => true;

  let ctx = `\n## COMMERCIAL DATA (DB-8 Invoices + DB-9 Manmonths)\n`;

  // ── Invoice table ──────────────────────────────────────────────────────────
  const relevantInvoices = invoices.filter(projFilter);
  if (relevantInvoices.length > 0) {
    const collected  = relevantInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    const submitted  = relevantInvoices.filter(i => i.status === 'Submitted').reduce((s, i) => s + i.amount, 0);
    const pending    = relevantInvoices.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0);
    const totalRaised = collected + submitted;

    ctx += `### Invoices & Payment Claims\n`;
    ctx += `| Invoice ID | Project | Type | Amount (AED) | Period | Status |\n`;
    ctx += `|---|---|---|---|---|---|\n`;
    relevantInvoices.forEach(inv => {
      const icon = inv.status === 'Paid' ? '✅' : inv.status === 'Submitted' ? '🟡' : '🔴';
      ctx += `| ${inv.id} | ${inv.projectCode} | ${inv.type} | ${inv.amount.toLocaleString()} | ${inv.period} | ${icon} ${inv.status} |\n`;
    });
    ctx += `\n**Totals**: ✅ Collected: AED ${collected.toLocaleString()} | 🟡 Submitted/Awaiting: AED ${submitted.toLocaleString()} | 🔴 Pending (not yet raised): AED ${pending.toLocaleString()} | Total Raised: AED ${totalRaised.toLocaleString()}\n\n`;
  }

  // ── Manmonth tracker table ─────────────────────────────────────────────────
  const relevantMM = manmonths.filter(projFilter);
  if (relevantMM.length > 0) {
    ctx += `### Man-Month Burn Rate (Monthly Tracker)\n`;
    ctx += `| Period | Project | Planned MM | Actual MM | Variance | Notes |\n`;
    ctx += `|---|---|---|---|---|---|\n`;
    relevantMM.forEach(mm => {
      const varStr = mm.variance >= 0 ? `+${mm.variance.toFixed(2)}` : mm.variance.toFixed(2);
      const note = mm.notes.length > 70 ? mm.notes.substring(0, 70) + '…' : mm.notes;
      ctx += `| ${mm.period} | ${mm.projectCode} | ${mm.planned} | ${mm.actual} | ${varStr} | ${note} |\n`;
    });
    const totalPlanned = relevantMM.reduce((s, m) => s + m.planned, 0);
    const totalActual  = relevantMM.reduce((s, m) => s + m.actual, 0);
    const effPct = totalPlanned ? Math.round((totalActual / totalPlanned) * 100) : 0;
    ctx += `\n**Cumulative**: Planned ${totalPlanned.toFixed(2)} MM | Actual ${totalActual.toFixed(2)} MM | Burn rate ${effPct}% of planned (${100 - effPct}% under-utilised)\n\n`;
  }

  return ctx;
}

// ── Build rich AI context ──────────────────────────────────────────────────────
function buildContext(projects, intent) {
  const today = new Date().toISOString().split('T')[0];
  const active = projects.filter(p => p.status === 'Active');
  const lumpSum = projects.filter(p => p.billingModel === 'Lump Sum');
  const resourcing = projects.filter(p => p.billingModel === 'Resourcing');
  const totalMM_B = projects.reduce((s, p) => s + (p.manmonthsBudgeted || 0), 0);
  const totalMM_U = projects.reduce((s, p) => s + (p.manmonthsUsed || 0), 0);
  const avgProgress = active.length ? Math.round(active.reduce((s,p)=>s+p.progress,0)/active.length) : 0;

  // If a specific project is mentioned, lead with full details for that project
  let focusProject = null;
  if (intent.mentionedProject) {
    // Match ALEMCO prefix for all three ALEMCO projects
    if (intent.mentionedProject === 'ALEMCO') {
      focusProject = projects.filter(p => p.name.startsWith('ALEMCO'));
    } else {
      focusProject = projects.filter(p => p.name === intent.mentionedProject ||
        p.name.toLowerCase().includes(intent.mentionedProject.toLowerCase()));
    }
  }

  let ctx = `# JES BIM OPERATIONS — LIVE DATA (${today})\n\n`;

  // Portfolio summary header
  ctx += `## PORTFOLIO SNAPSHOT\n`;
  ctx += `| KPI | Value |\n|---|---|\n`;
  ctx += `| Total Projects | ${projects.length} |\n`;
  ctx += `| Active | ${active.length} |\n`;
  ctx += `| Lump Sum | ${lumpSum.length} |\n`;
  ctx += `| Resourcing | ${resourcing.length} |\n`;
  ctx += `| Avg Progress (Active) | ${avgProgress}% |\n`;
  ctx += `| Total Team | ${projects.reduce((s,p)=>s+p.teamSize,0)} |\n`;
  ctx += `| Total MM Budgeted | ${totalMM_B.toFixed(1)} |\n`;
  ctx += `| Total MM Used | ${totalMM_U.toFixed(1)} |\n`;
  ctx += `| MM Utilisation | ${totalMM_B ? Math.round((totalMM_U/totalMM_B)*100) : 0}% |\n`;
  ctx += `| Total Contract Value | AED ${lumpSum.reduce((s,p)=>s+(p.contractValue||0),0).toLocaleString()} |\n\n`;

  // Risk flags
  const atRisk = projects.filter(p => p.manmonthsBudgeted && (p.manmonthsUsed/p.manmonthsBudgeted) > 0.9);
  const noProgress = active.filter(p => p.progress === 0);
  if (atRisk.length > 0) {
    ctx += `## ⚠️ AT-RISK PROJECTS (MM > 90%)\n`;
    atRisk.forEach(p => {
      const pct = Math.round((p.manmonthsUsed/p.manmonthsBudgeted)*100);
      ctx += `- **${p.name}**: ${p.manmonthsUsed}/${p.manmonthsBudgeted} MM (${pct}% used)\n`;
    });
    ctx += '\n';
  }

  // If a specific project was asked about, give full detail first
  if (focusProject && focusProject.length > 0) {
    ctx += `## FOCUS: ${intent.mentionedProject}\n`;
    focusProject.forEach(p => {
      const mmPct = p.manmonthsBudgeted ? Math.round((p.manmonthsUsed/p.manmonthsBudgeted)*100) : 0;
      const risk = mmPct >= 90 ? '🔴 CRITICAL' : mmPct >= 75 ? '🟡 WATCH' : '🟢 OK';
      ctx += `### ${p.name} (${p.code})\n`;
      ctx += `- **Billing**: ${p.billingModel} | **Status**: ${p.status} | **Stage**: ${p.stage}\n`;
      ctx += `- **Client**: ${p.client} | **Location**: ${p.location}\n`;
      ctx += `- **Progress**: ${p.progress}% complete\n`;
      ctx += `- **Team Size**: ${p.teamSize} people\n`;
      ctx += `- **Disciplines**: ${p.disciplines.join(', ')}\n`;
      ctx += `- **Contract Value**: AED ${(p.contractValue||0).toLocaleString()}\n`;
      if (p.claimPct != null) ctx += `- **Claim (May forecast)**: ${p.claimPct}% → AED ${(p.claimValueForecast||0).toLocaleString()}\n`;
      if (p.monthlyRatePerResource) ctx += `- **Monthly Rate/Resource**: AED ${p.monthlyRatePerResource.toLocaleString()}\n`;
      ctx += `- **Man-months**: ${p.manmonthsUsed} used / ${p.manmonthsBudgeted} budgeted → ${mmPct}% ${risk}\n`;
      ctx += `- **Scope**: ${p.scope}\n`;
      ctx += `- **Files in folder**: ${(p.totalFiles||0).toLocaleString()}\n`;
      if (p.riskFlags && p.riskFlags.length) ctx += `- **⚠️ Risk Flags**: ${p.riskFlags.join('; ')}\n`;
      if (p.milestones) {
        const ms = Object.entries(p.milestones).map(([k,v]) => `${k}: ${v}`).join(', ');
        ctx += `- **Milestones**: ${ms}\n`;
      }
      ctx += `\n`;
    });
  }

  // All projects table
  ctx += `## ALL PROJECTS\n`;
  ctx += `| Project | Type | Stage | Progress | Team | Contract Value (AED) | Claim% | Files |\n`;
  ctx += `|---|---|---|---|---|---|---|---|\n`;
  projects.forEach(p => {
    const claimStr = p.claimPct != null ? `${p.claimPct}%` : '-';
    const valueStr = p.contractValue ? p.contractValue.toLocaleString() : '-';
    ctx += `| ${p.name} | ${p.billingModel} | ${p.stage} | ${p.progress}% | ${p.teamSize} | ${valueStr} | ${claimStr} | ${(p.totalFiles||0).toLocaleString()} |\n`;
  });

  return ctx;
}

// ── Build Notion DB context ──────────────────────────────────────────────────
// Renders whatever Notion data was fetched (deliverables, issues, variations,
// etc.) into compact markdown tables the model can reason over. We cap each
// section to the first ~25 rows so the prompt stays reasonable.
function buildNotionContext(data, intent) {
  if (!data || !Object.keys(data).length) return '';
  const parts = [];
  const cap = 25;

  const section = (title, rows, render) => {
    if (!rows?.length) return;
    parts.push(`\n## ${title} (${rows.length} total${rows.length > cap ? `, showing ${cap}` : ''}):\n${rows.slice(0, cap).map(render).join('\n')}`);
  };

  section('DELIVERABLES — DB-1', data.deliverables, r =>
    `- ${r.drawingNo || '—'} | ${r.discipline || '-'} | LOD ${r.lod || '-'} | ${r.status || '-'} | submitted: ${r.submittedDate || '—'} | approved: ${r.approvedDate || '—'}`);

  section('SCHEDULE & MILESTONES — DB-2', data.schedule, r =>
    `- ${r.milestone || '—'} | planned ${r.plannedPct || 0}% / actual ${r.actualPct || 0}% | due ${r.plannedDate || '—'} | ${r.status || '-'}`);

  section('INPUTS & PREREQUISITES — DB-3', data.inputs, r =>
    `- ${r.item || '—'} | ${r.type || '-'} | due ${r.dueDate || '—'} | received ${r.receivedDate || '—'} | ${r.status || '-'}`);

  section('RFIs / ISSUES / CLASHES — DB-4', data.issues, r =>
    `- ${r.ref || '—'} | ${r.type || '-'} | ${r.severity || '-'} | ${r.status || '-'} | raised ${r.raisedDate || '—'} by ${r.raisedBy || '—'}${r.description ? ` — ${r.description.slice(0, 120)}` : ''}`);

  section('COMMUNICATIONS & SUBMISSIONS — DB-5', data.comms, r =>
    `- ${r.ref || '—'} | ${r.type || '-'} | ${r.direction || '-'} | ${r.date || '—'} | ${r.subject || ''} | ${r.status || '-'}`);

  section('DOCUMENT REGISTER — DB-6', data.documents, r =>
    `- ${r.docNo || '—'} | ${r.category || '-'} | rev ${r.revision || '—'} | ${r.date || '—'} | ${r.title || ''}`);

  section('MODEL UPDATES — DB-7', data.modelUpdates, r =>
    `- ${r.revision || '—'} | ${r.date || '—'} | ${r.author || '—'} | ${r.summary || ''}`);

  section('VARIATIONS — DB-10', data.variations, r =>
    `- ${r.variationId || '—'} | ${r.reason || '-'} | ${r.status || '-'} | cost ${r.costImpact != null ? r.costImpact.toLocaleString() : '—'} | time ${r.timeImpactDays != null ? r.timeImpactDays + 'd' : '—'} | raised ${r.raisedDate || '—'}`);

  section('KPI / PERFORMANCE — DB-11', data.kpi, r =>
    `- ${r.staffName || '—'} | ${r.project || '-'} | ${r.kpiType || '-'} = ${r.kpiValue != null ? r.kpiValue : '—'} | ${r.dayStatus || '-'} | ${r.date || '—'}`);

  section('TIMESHEETS — DB-12', data.timesheets, r =>
    `- ${r.employee || '—'} | ${r.date || '—'} | ${r.hours || 0}h | ${r.task || ''} | billable: ${r.billable ? 'yes' : 'no'}`);

  if (!parts.length) return '';
  const scope = intent.mentionedProject ? ` (filtered to ${intent.mentionedProject})` : '';
  return `\n\n## NOTION MASTER REGISTERS${scope}:${parts.join('')}`;
}

// ── Build smart system prompt ─────────────────────────────────────────────────
function buildSystemPrompt(intent, userName) {
  const name = userName ? userName.split('@')[0] : 'team';

  return `You are the JES BIM Operations AI — an expert assistant for JES BIM's project portfolio management team. You have real-time access to all project data below.

## WHO YOU ARE:
- You know every JES BIM project intimately: progress, team, man-months, contract values, risks
- You speak like a sharp BIM manager — confident, data-driven, precise
- You use 🟢 🟡 🔴 for status (OK / Watch / Critical)

## HOW TO RESPOND:
1. **Lead with the key number or fact** — don't build up slowly
2. **Use markdown tables** when comparing 2+ projects
3. **Always name the project** — never say "this project" or "the project"
4. **Flag risks proactively** — if you see >75% MM utilisation or 0% progress on an active project, mention it even if not asked
5. **Be concise** — max 250 words unless user asks for full detail
6. **Suggest one follow-up** at the end of complex answers using: *💡 You could also ask: "..."*

## SPECIAL TRIGGERS:
- If asked for a **report/PDF/Excel** → say: *"Type 'generate report' and I'll create a downloadable PDF/Excel for you."*
- If asked about **team headcount** → check Team Size column; note 0 means data not yet in system
- If asked about **Lump Sum revenue** → sum Contract Values for Lump Sum projects only; for claim forecasts use Claim% × Contract Value
- If asked about **May 2026 claims/revenue** → use claimValueForecast fields (from Arch Google Sheet live data); total forecast Arch claim ≈ AED 67,308 across 8 lump-sum projects (WAI, Bendito, ASGC×3, IKK, INNOVO, ALEC RSMLI)
- If asked **which project is at risk** → check MM% column, flag >75%
- If asked about **files** → total_files is the count of raw project files in the folder
- If asked about **invoices/payments/billing/revenue** → use the COMMERCIAL DATA section below

## COMMERCIAL & BILLING KNOWLEDGE:
- **WPH KSA** (AED 167,775 contract): 4 milestone invoices
  - INV-WPH-001: AED 33,555 — M1 Advance (Dec 2025) ✅ PAID
  - INV-WPH-002: AED 50,332.50 — M2 50% Submission (Feb 2026) ✅ PAID
  - INV-WPH-003: AED 67,110 — M3 100% Submission (Mar 2026) 🟡 SUBMITTED — awaiting client payment
  - INV-WPH-004: AED 16,777.50 — M4 Client Approval (TBD) 🔴 PENDING — awaiting client sign-off
  - **Collected: AED 83,887.50 | Outstanding: AED 83,887.50**
- **ALEMCO Wynn**: PA-ALC-WN-FEB26 — AED 339,320 (Feb 2026) 🔴 PENDING — timesheet PDFs needed
  - Rate: AED 8,483/resource/month × 40 resources
- **WPH KSA Man-Month Burn** (planned 5.65 MM/month):
  - Dec 2025: 2.8 actual | Jan 2026: 3.1 | Feb 2026: 3.26 | Mar 2026: 3.5
  - Cumulative: 12.66/22.6 MM (56%) — well under budget, team running lean
  - Trend: burn rate increasing each month as more resources are active

## RESOURCE DATA:
- Live from Notion Resource Tracker — 204 staff total (67 Arch + 137 MEP) as of April 2026
- Each person has: Name, Designation, Grade, Discipline, Location (Chennai/Trichy/Dubai), Current Project, Status, Reason
- Bench resources have current_project = "Internal" and Reason = "Bench - Available"
- When asked about bench/available staff — list names, grades, and locations from bench list
- MEP discipline types: Electrical, Mechanical, Plumbing
- Status options: Active, Inactive, On Notice, On Probation, Resigned, Terminated
- When asked about team on a project, list names, grades, and locations

## WHAT YOU DON'T KNOW YET:
- Exact start/end dates (not in system yet)
- BEP/MIDP status (not tracked yet)
- Drawing counts per project (not tracked yet)
- For projects showing 0% progress or 0 team — data is pending update in the folder

## JES BIM CONTEXT:
- JES BIM is a BIM consultancy based in Dubai, UAE
- Lump Sum projects = fixed-fee deliverable contracts (shop drawings, BIM models)
- Resourcing projects = staff deputation to client offices (billed per man-month)
- ALEMCO projects (Wynn, Data Centre, Admin Bldg) are MEP resourcing for the same client

Today you're speaking with: ${name}`;
}

// ── Generate full report content ──────────────────────────────────────────────
async function generateReportContent(projects, reportType, requestedBy) {
  const ctx = buildContext(projects, {});
  const prompt = `You are the JES BIM Operations Report Engine. Generate a professional, complete ${reportType}.

## DATA:
${ctx}

## REPORT REQUIREMENTS:
- Date: ${new Date().toISOString().split('T')[0]}
- Requested by: ${requestedBy}

Generate a full report in markdown with these sections:
1. **Executive Summary** — 3-5 bullet key takeaways with real numbers
2. **Portfolio Overview** — KPI table (Project | Type | Status | Progress% | Team | MM Used/Budget | MM% | Flag)
3. **Lump Sum Projects** — breakdown per project (client, progress, contract value, scope)
4. **Resourcing Projects** — breakdown per project (client, team, MM burn rate)
5. **Man-Month Analysis** — table sorted by MM% descending, flag 🔴 >90% and 🟡 >75%
6. **Risks & Issues** — projects with 0% progress, high MM burn, or missing data
7. **Recommendations** — 3-5 clear action items for the operations team

Use markdown tables. Be precise. Only use numbers from the data above. Do not invent data.`;

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!claudeRes.ok) throw new Error('Failed to generate report content');
  const data = await claudeRes.json();
  return data.content[0].text;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { messages, fileContent } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

    const latestMessage = messages[messages.length - 1]?.content || '';
    const intent = detectIntent(latestMessage);

    // ── REPORT REQUEST PATH ───────────────────────────────────────────
    if (intent.isReport && decoded.role !== 'Viewer') {
      const projects = await fetchProjects(intent.billingModel);

      let targetProjects = projects;
      if (intent.mentionedProject && intent.mentionedProject !== 'ALEMCO') {
        const filtered = projects.filter(p =>
          p.name.toLowerCase().includes(intent.mentionedProject.toLowerCase()));
        if (filtered.length > 0) targetProjects = filtered;
      } else if (intent.mentionedProject === 'ALEMCO') {
        const filtered = projects.filter(p => p.name.startsWith('ALEMCO'));
        if (filtered.length > 0) targetProjects = filtered;
      }

      const reportType = intent.isExcel ? 'Excel Export' : 'Project Status Report';
      const reportContent = await generateReportContent(targetProjects, reportType, decoded.email);
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const title = `JES BIM ${reportType} — ${dateStr}`;

      // ── Master Template Pack v1.0 routing ──────────────────────────
      // Classify the intent to one of the 16 templates and build a
      // structured data payload. The frontend uses `templateId` to
      // decide whether to call /api/reports/master (structured PDF)
      // or fall back to /api/reports/pdf (markdown-styled PDF).
      let templateId = null;
      let templateData = null;
      try {
        const router = require('./reports/_master/router');
        templateId = router.classifyTemplateId(intent, latestMessage);
        templateData = router.buildData(templateId, {
          projects: targetProjects,
          project: targetProjects.length === 1 ? targetProjects[0] : null,
          period: dateStr,
          user: decoded.name || decoded.email,
          resources: [], // bench/attendance data plugged in by resource-aware templates later
        });
      } catch (err) {
        console.warn('Master template routing failed, falling back to markdown:', err.message);
      }

      return res.status(200).json({
        success: true,
        type: 'report',
        reply: `✅ **${title}** is ready.\n\n📊 ${targetProjects.length} project${targetProjects.length !== 1 ? 's' : ''} included${intent.billingModel ? ` (${intent.billingModel} only)` : ''}.\n\nUse the buttons below to **download as PDF or Excel**.`,
        reportData: {
          title,
          content: reportContent,
          projectCount: targetProjects.length,
          type: reportType,
          generatedAt: new Date().toISOString(),
          filters: {
            billingModelFilter: intent.billingModel || null,
            projectName: intent.mentionedProject || null,
          },
          // Master Template Pack v1.0 additions
          templateId,
          templateData,
        }
      });
    }

    // ── Viewer tries to generate a report ─────────────────────────────
    if (intent.isReport && decoded.role === 'Viewer') {
      return res.status(200).json({
        success: true,
        type: 'message',
        reply: '⚠️ Report generation requires **Manager** or **Admin** access. Please contact your administrator to upgrade your access level.'
      });
    }

    // ── STANDARD CHAT PATH ────────────────────────────────────────────
    const needsCommercial = intent.isBillingQuery || intent.isMMQuery || intent.isPortfolioQuery ||
                            (intent.mentionedProject && (intent.mentionedProject === 'WPH KSA' || intent.mentionedProject.includes('ALEMCO')));

    // Decide which Notion DBs to hit based on intent. We skip DBs the user
    // isn't asking about to keep chat latency low.
    const notionWants = {
      deliverables: intent.isDeliverableQuery,
      schedule:     intent.isScheduleQuery,
      issues:       intent.isRfiQuery || intent.isRiskQuery,
      inputs:       intent.isInputQuery,
      comms:        intent.isCommsQuery,
      documents:    intent.isDocQuery,
      modelUpdates: intent.isModelQuery,
      variations:   intent.isVariationQuery,
      kpi:          intent.isKpiQuery,
      timesheets:   intent.isTimesheetQuery,
    };
    const hasNotionIntent = Object.values(notionWants).some(Boolean);

    const [projects, resources, commercial, notionData] = await Promise.all([
      fetchProjects(intent.billingModel),
      fetchResources(),
      needsCommercial ? fetchCommercialData() : Promise.resolve(null),
      hasNotionIntent
        ? notionDbs.fetchRelevant({ projectName: intent.mentionedProject, wants: notionWants }).catch(e => {
            console.warn('Notion DB fetch failed:', e.message);
            return {};
          })
        : Promise.resolve({}),
    ]);

    const context       = buildContext(projects, intent);
    const resCtx        = (intent.isTeamQuery || intent.mentionedProject)
                         ? buildResourceContext(resources, intent)
                         : `\n## RESOURCES: ${resources.arch.length} Arch + ${resources.mep.length} MEP = ${resources.all.length} total staff\n`;
    const commercialCtx = buildCommercialContext(commercial, intent);
    const notionCtx     = buildNotionContext(notionData, intent);
    const systemPrompt  = buildSystemPrompt(intent, decoded.email);

    const apiMessages = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt + '\n\n## LIVE DATA:\n' + context + resCtx + commercialCtx + notionCtx + (fileContent ? `\n\n## UPLOADED FILE:\n${fileContent}` : ''),
        messages: apiMessages
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json();
      throw new Error(err.error?.message || 'Claude API error');
    }

    const data = await claudeRes.json();
    return res.status(200).json({
      success: true,
      type: 'message',
      reply: data.content[0].text,
      usage: data.usage
    });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
