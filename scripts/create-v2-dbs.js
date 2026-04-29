#!/usr/bin/env node
/**
 * Creates the remaining 10 v2 Notion databases (DB-2 through DB-12).
 *
 * Already built (manually via MCP):
 *   DB-A Projects Master       (ee55983748e64b5382823ab5d1a0a192)
 *   DB-B People & Resources    (57cfd1f84a654c7dbe0448f07cd12725)
 *   DB-C Clients & Contacts    (2db7bd36cbd64d6d859b9bdf9dde62d8)
 *   DB-1 Deliverables Register (a637527fa2b04ccd85c29c2bd9714a51)
 *
 * Usage:
 *   cd jes-bim-chatbot
 *   node scripts/create-v2-dbs.js
 *
 * Reads NOTION_TOKEN from .env.local. Outputs a Vercel env-var script
 * (`scripts/set-vercel-env-v2.ps1`) at the end — run that next.
 */

const fs   = require('fs');
const path = require('path');

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
}

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error('NOTION_TOKEN missing'); process.exit(1); }

const HEADERS = {
  'Authorization':  `Bearer ${TOKEN}`,
  'Content-Type':   'application/json',
  'Notion-Version': '2022-06-28',
};

const PARENT_PAGE = '3502d6b7-290f-81d2-be0c-c52ed229c7ad';   // SSOT Hub v2
const DB_A_ID     = 'ee55983748e64b5382823ab5d1a0a192';        // Projects Master v2
const DB_B_ID     = '57cfd1f84a654c7dbe0448f07cd12725';        // People v2
const DB_1_ID     = 'a637527fa2b04ccd85c29c2bd9714a51';        // Deliverables v2

// ── Schema helpers ───────────────────────────────────────────────────────────
const T = {
  title:    () => ({ title: {} }),
  text:     () => ({ rich_text: {} }),
  number:   (fmt) => ({ number: { format: fmt || 'number' } }),
  date:     () => ({ date: {} }),
  email:    () => ({ email: {} }),
  phone:    () => ({ phone_number: {} }),
  url:      () => ({ url: {} }),
  checkbox: () => ({ checkbox: {} }),
  people:   () => ({ people: {} }),
  ctime:    () => ({ created_time: {} }),
  ltime:    () => ({ last_edited_time: {} }),
  uniqueId: (prefix) => ({ unique_id: { prefix } }),
  relation: (dbId) => ({ relation: { database_id: dbId, single_property: {} } }),
  select:   (opts) => ({ select: { options: opts.map(([name, color]) => ({ name, color })) } }),
  multi:    (opts) => ({ multi_select: { options: opts.map(([name, color]) => ({ name, color })) } }),
  formula:  (expr) => ({ formula: { expression: expr } }),
};

// ── Standard fields applied to every DB ──────────────────────────────────────
const STANDARD = {
  'Tags':        T.multi([['Important','red'],['Review','orange'],['Archive','gray']]),
  'Notes':       T.text(),
  'Created':     T.ctime(),
  'Last Edited': T.ltime(),
  'Created By':  T.people(),
};

const DISCIPLINE_OPTS = [
  ['Architectural','blue'],['MEP - Electrical','orange'],['MEP - Mechanical','yellow'],
  ['MEP - Plumbing','green'],['Structural','purple'],['Coordination','default'],['ID & Joinery','pink'],
];

// ── DB definitions ───────────────────────────────────────────────────────────
const DBS = [
  {
    key: 'NOTION_SCHEDULE_DB_V2', title: 'DB-2: Schedule & Milestones',
    properties: {
      'Name':         T.title(),
      'Project':      T.relation(DB_A_ID),
      'Phase':        T.select([['Design','blue'],['Coordination','purple'],['Submission','yellow'],['Approval','green'],['Handover','pink']]),
      'Planned Date': T.date(),
      'Actual Date':  T.date(),
      'Planned %':    T.number('percent'),
      'Actual %':     T.number('percent'),
      'Variance':     T.formula('prop("Actual %") - prop("Planned %")'),
      'Status':       T.select([['Not Started','gray'],['In Progress','blue'],['Achieved','green'],['Delayed','orange'],['At Risk','red']]),
      'Owner':        T.relation(DB_B_ID),
      'Dependencies': T.text(),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_INPUTS_DB_V2', title: 'DB-3: Inputs & Prerequisites',
    properties: {
      'Name':           T.title(),
      'Project':        T.relation(DB_A_ID),
      'Input Type':     T.select([
        ['Reference Model','default'],['Design Drawing','blue'],['Specification','green'],
        ['Shop Drawing Template','orange'],['BEP Standards','red'],['RFI Response','purple'],
        ['Client Approval','yellow'],['Material Submittal','pink'],['Single Line Diagram','brown'],
        ['Room Matrix','gray'],['Typical Detail','default'],['Asset Data Template','blue']
      ]),
      'Discipline':     T.select(DISCIPLINE_OPTS),
      'Status':         T.select([['Not Requested','gray'],['Requested','blue'],['Received','green'],['Partial','yellow'],['Overdue','red'],['N/A','default']]),
      'Requested Date': T.date(),
      'Expected Date':  T.date(),
      'Received Date':  T.date(),
      'Source':         T.text(),
      'Blocking':       T.checkbox(),
      'Blocked Drawings': T.relation(DB_1_ID),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_ISSUES_DB_V2', title: 'DB-4: RFIs / Issues / Clashes',
    properties: {
      'Name':         T.title(),
      'Issue ID':     T.uniqueId('RFIv2'),
      'Project':      T.relation(DB_A_ID),
      'Type':         T.select([['RFI','default'],['Hard Clash','red'],['Soft Clash','orange'],['Design Issue','purple'],['Missing Info','yellow'],['Scope Change','blue'],['Query','gray']]),
      'Status':       T.select([['Open','red'],['In Progress','orange'],['Pending Client','yellow'],['Pending Consultant','blue'],['Resolved','green'],['Closed','gray']]),
      'Priority':     T.select([['Critical','red'],['High','orange'],['Medium','yellow'],['Low','green']]),
      'Discipline':   T.multi(DISCIPLINE_OPTS),
      'Raised By':    T.relation(DB_B_ID),
      'Assigned To':  T.relation(DB_B_ID),
      'Raised Date':  T.date(),
      'Due Date':     T.date(),
      'Resolved Date':T.date(),
      'Linked Drawings': T.relation(DB_1_ID),
      'Description':  T.text(),
      'Resolution':   T.text(),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_COMMS_DB_V2', title: 'DB-5: Communications & Submissions',
    properties: {
      'Name':         T.title(),
      'Project':      T.relation(DB_A_ID),
      'Comm Type':    T.select([['Email','blue'],['Letter','purple'],['MOM','green'],['Phone Call','orange'],['Teams Message','yellow'],['Transmittal','red'],['WhatsApp','pink']]),
      'Direction':    T.select([['Incoming','blue'],['Outgoing','green'],['Internal','gray']]),
      'Date':         T.date(),
      'From':         T.text(),
      'To':           T.text(),
      'Status':       T.select([['Open','blue'],['Awaiting Reply','orange'],['Replied','green'],['Closed','gray']]),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_DOCUMENTS_DB_V2', title: 'DB-6: Document Register',
    properties: {
      'Name':         T.title(),
      'Doc Number':   T.text(),
      'Project':      T.relation(DB_A_ID),
      'Category':     T.select([['BEP','blue'],['MIDP','purple'],['Execution Plan','orange'],['Kickoff Document','green'],['Material Submittal','pink'],['Asset Data','yellow'],['LPO','red'],['Meeting Notes','default'],['Monthly Report','brown'],['Org Chart','gray']]),
      'Revision':     T.text(),
      'Status':       T.select([['Draft','gray'],['Issued','blue'],['Approved','green'],['Superseded','red']]),
      'Date':         T.date(),
      'Owner':        T.relation(DB_B_ID),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_MODEL_UPDATES_DB_V2', title: 'DB-7: Model Updates Log',
    properties: {
      'Name':         T.title(),
      'Project':      T.relation(DB_A_ID),
      'Date':         T.date(),
      'Author':       T.relation(DB_B_ID),
      'Update Type':  T.select([['Coordination Fix','blue'],['Modified','orange'],['Deleted','red'],['New Elements','green'],['Family Change','purple'],['Parameter Update','yellow']]),
      'Discipline':   T.select(DISCIPLINE_OPTS),
      'Affected Elements': T.text(),
      'Summary':      T.text(),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_COMMERCIAL_DB_V2', title: 'DB-8: Commercial & Invoicing',
    properties: {
      'Name':         T.title(),
      'Invoice No':   T.text(),
      'Project':      T.relation(DB_A_ID),
      'Type':         T.select([['PA Claim','blue'],['Invoice','green'],['Credit Note','orange'],['Variation Invoice','purple']]),
      'Status':       T.select([['Draft','gray'],['Submitted','blue'],['Under Review','orange'],['Approved','green'],['Rejected','red'],['Paid','purple']]),
      'Issue Date':   T.date(),
      'Due Date':     T.date(),
      'Paid Date':    T.date(),
      'Net Payable':  T.number('number'),
      'Retention':    T.number('number'),
      'Currency':     T.select([['AED','red'],['USD','green'],['INR','orange'],['SAR','yellow']]),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_MANMONTHS_DB_V2', title: 'DB-9: Manmonth Consumption',
    properties: {
      'Name':                T.title(),
      'Entry ID':            T.uniqueId('MMv2'),
      'Project':             T.relation(DB_A_ID),
      'Month':               T.date(),
      'Package / Discipline':T.select(DISCIPLINE_OPTS),
      'Budgeted Manmonths':  T.number('number'),
      'Consumed This Month': T.number('number'),
      'Cumulative Consumed': T.number('number'),
      'Burn Rate %':         T.formula('prop("Cumulative Consumed") / prop("Budgeted Manmonths") * 100'),
      'Planned Progress %':  T.number('percent'),
      'Actual Progress %':   T.number('percent'),
      'Health Status':       T.select([['On Track','green'],['At Risk','orange'],['Over Budget','red']]),
      'Resources Deployed':  T.number('number'),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_VARIATIONS_DB_V2', title: 'DB-10: Variation Register',
    properties: {
      'Name':         T.title(),
      'Variation ID': T.uniqueId('VOv2'),
      'Project':      T.relation(DB_A_ID),
      'Status':       T.select([['Draft','gray'],['Submitted','blue'],['Pending Approval','orange'],['Approved','green'],['Rejected','red'],['Withdrawn','default']]),
      'Reason':       T.select([['Client Change','blue'],['Scope Add','green'],['Scope Remove','orange'],['Design Dev','purple'],['Errors','red'],['Site Conditions','yellow']]),
      'Cost Impact':  T.number('number'),
      'Time Impact (days)': T.number('number'),
      'Resource Impact (manmonths)': T.number('number'),
      'Raised Date':  T.date(),
      'Approved Date':T.date(),
      'Approved By':  T.text(),
      'Linked Drawings': T.relation(DB_1_ID),
      'Description':  T.text(),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_KPI_DB_V2', title: 'DB-11: KPI Dashboard',
    properties: {
      'Name':           T.title(),
      'Project':        T.relation(DB_A_ID),
      'Month':          T.date(),
      'Staff':          T.relation(DB_B_ID),
      'KPI Type':       T.select([['Productivity','blue'],['Quality','purple'],['Timeliness','orange'],['Attendance','green'],['Teamwork','yellow'],['Sheet KPI','pink'],['Model KPI','red'],['Param KPI','default']]),
      'KPI Value':      T.number('number'),
      'Target':         T.number('number'),
      'Achievement %':  T.formula('prop("KPI Value") / prop("Target") * 100'),
      'Day Status':     T.select([['Present','green'],['Half Day','yellow'],['Leave','red'],['Holiday','blue'],['WFH','purple']]),
      'Rating':         T.select([['Outstanding','green'],['Exceeds','blue'],['Meets','yellow'],['Needs Improvement','red']]),
      ...STANDARD,
    }
  },
  {
    key: 'NOTION_TIMESHEETS_DB_V2', title: 'DB-12: Timesheet Register',
    properties: {
      'Name':         T.title(),
      'Entry ID':     T.uniqueId('TSv2'),
      'Project':      T.relation(DB_A_ID),
      'Employee':     T.relation(DB_B_ID),
      'Date':         T.date(),
      'Hours':        T.number('number'),
      'Task':         T.text(),
      'Discipline':   T.select(DISCIPLINE_OPTS),
      'Billable':     T.checkbox(),
      'Status':       T.select([['Draft','gray'],['Submitted','blue'],['Approved','green'],['Rejected','red'],['Invoiced','purple']]),
      'Rate Type':    T.select([['Type 1 — Monthly','blue'],['Type 2 — Man-hours','orange']]),
      'Rate AED/hr':  T.number('number'),
      'Amount':       T.formula('prop("Hours") * prop("Rate AED/hr")'),
      'Week Ending':  T.date(),
      'Submitted By': T.text(),
      'Approved By':  T.text(),
      ...STANDARD,
    }
  },
];

// ── Create each DB ───────────────────────────────────────────────────────────
async function createDb(def) {
  const body = {
    parent: { type: 'page_id', page_id: PARENT_PAGE },
    title:  [{ type: 'text', text: { content: def.title } }],
    properties: def.properties,
  };
  const resp = await fetch('https://api.notion.com/v1/databases', {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`${def.title}: ${resp.status} ${err.slice(0, 250)}`);
  }
  return await resp.json();
}

(async () => {
  const created = {};
  console.log(`\nBuilding ${DBS.length} v2 databases under SSOT Hub v2...\n`);
  for (const def of DBS) {
    try {
      process.stdout.write(`[${def.title}] ... `);
      const r = await createDb(def);
      const id = r.id.replace(/-/g, '');
      created[def.key] = id;
      console.log(`OK  ${id}`);
    } catch (e) {
      console.error(`FAIL  ${e.message}`);
    }
    // Notion rate limit: 3 req/s. Sleep 400ms between calls.
    await new Promise(r => setTimeout(r, 400));
  }

  // Output the .env snippet + Vercel script
  console.log('\n══════════════════════════════════════════════');
  console.log(' Created DB IDs:');
  console.log('══════════════════════════════════════════════\n');
  for (const [k, v] of Object.entries(created)) console.log(`${k}=${v}`);

  // Generate a Vercel env script
  const allEnvs = {
    'NOTION_PROJECTS_DB':     'ee55983748e64b5382823ab5d1a0a192',
    'NOTION_PEOPLE_DB':       '57cfd1f84a654c7dbe0448f07cd12725',
    'NOTION_CLIENTS_DB':      '2db7bd36cbd64d6d859b9bdf9dde62d8',
    'NOTION_DELIVERABLES_DB': 'a637527fa2b04ccd85c29c2bd9714a51',
    ...Object.fromEntries(Object.entries(created).map(([k,v]) => [k.replace('_V2', ''), v])),
  };
  const psScript = [
    '# Auto-generated v2 Vercel env-var setter. Run from jes-bim-chatbot folder.',
    '$envs = @{',
    ...Object.entries(allEnvs).map(([k,v]) => `    "${k}" = "${v}"`),
    '}',
    'foreach ($key in $envs.Keys) {',
    '    Write-Host "[$key] -> $($envs[$key])" -ForegroundColor Yellow',
    '    & vercel env rm $key production --yes 2>$null | Out-Null',
    '    $envs[$key] | & vercel env add $key production 2>&1 | Out-Null',
    '}',
    'Write-Host "Done. Run: vercel --prod" -ForegroundColor Cyan',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, 'set-vercel-env-v2.ps1'), psScript);
  console.log('\n══════════════════════════════════════════════');
  console.log(' Wrote scripts/set-vercel-env-v2.ps1');
  console.log(' Next:  powershell -ExecutionPolicy Bypass -File scripts\\set-vercel-env-v2.ps1');
  console.log('══════════════════════════════════════════════\n');
})().catch(e => { console.error(e); process.exit(1); });
