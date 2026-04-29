/**
 * Unified query layer for all JES BIM Notion databases.
 *
 * DB IDs come from env vars (see .env.example). Each database has a
 * dedicated query function that accepts an optional `projectFilter` so
 * the chatbot can ask things like "H2R RFIs" or "Orla deliverables".
 *
 * Tier 1 — Master Registers:
 *   fetchProjects()         — DB-A
 *   fetchPeople()           — DB-B
 *   fetchClients()          — DB-C
 *
 * Tier 2 — Production Tracking:
 *   fetchDeliverables()     — DB-1  (drawings, submissions, LOD status)
 *   fetchSchedule()         — DB-2  (milestones, dates, % complete)
 *   fetchInputs()           — DB-3  (prerequisites, marketing plans, etc.)
 *   fetchIssues()           — DB-4  (RFIs, clashes, open items)
 *   fetchComms()            — DB-5  (submissions log, emails, replies)
 *   fetchDocuments()        — DB-6  (specs, contracts, drawings register)
 *   fetchModelUpdates()     — DB-7  (revision log)
 *
 * Tier 3 — Commercial & Performance:
 *   fetchCommercial()       — DB-8  (invoices, PA claims)
 *   fetchManmonths()        — DB-9  (planned vs actual hours)
 *   fetchVariations()       — DB-10 (change orders)
 *   fetchKPI()              — DB-11 (employee performance)
 *   fetchTimesheets()       — DB-12 (resourcing timesheets)
 */

const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── Helpers ──────────────────────────────────────────────────────────────────
const text = (p, key)   => ((p[key]?.rich_text || [])[0]?.plain_text || '').trim();
const title = (p, key)  => ((p[key]?.title || [])[0]?.plain_text || '').trim();
const sel = (p, key)    => p[key]?.select?.name || null;
const multi = (p, key)  => (p[key]?.multi_select || []).map(s => s.name);
const num = (p, key)    => p[key]?.number ?? null;
const date = (p, key)   => p[key]?.date?.start || null;
const check = (p, key)  => !!p[key]?.checkbox;
const relation = (p, key) => (p[key]?.relation || []).map(r => r.id);

function listEnvDbs() {
  return {
    projects:     process.env.NOTION_PROJECTS_DB,
    people:       process.env.NOTION_PEOPLE_DB,
    clients:      process.env.NOTION_CLIENTS_DB,
    deliverables: process.env.NOTION_DELIVERABLES_DB,
    schedule:     process.env.NOTION_SCHEDULE_DB,
    inputs:       process.env.NOTION_INPUTS_DB,
    issues:       process.env.NOTION_ISSUES_DB,
    comms:        process.env.NOTION_COMMS_DB,
    documents:    process.env.NOTION_DOCUMENTS_DB,
    modelUpdates: process.env.NOTION_MODEL_UPDATES_DB,
    commercial:   process.env.NOTION_COMMERCIAL_DB,
    manmonths:    process.env.NOTION_MANMONTHS_DB,
    variations:   process.env.NOTION_VARIATIONS_DB,
    kpi:          process.env.NOTION_KPI_DB,
    timesheets:   process.env.NOTION_TIMESHEETS_DB,
  };
}

// Small in-memory cache so repeated chat turns don't hammer the Notion API.
const _cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function _queryAll(dbId, filter) {
  if (!dbId) return [];
  // Sentinel: project not found in DB-A, return empty instead of querying.
  if (filter && filter._noMatch) return [];
  const cacheKey = `${dbId}|${JSON.stringify(filter || {})}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;

  const rows = [];
  let cursor;
  try {
    do {
      const resp = await notion.databases.query({
        database_id: dbId,
        filter: filter || undefined,
        page_size: 100,
        start_cursor: cursor,
      });
      rows.push(...resp.results);
      cursor = resp.has_more ? resp.next_cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.warn(`Notion query failed for DB ${dbId}: ${e.message}`);
    return [];
  }
  _cache.set(cacheKey, { rows, at: Date.now() });
  return rows;
}

// ── Project name → DB-A page ID resolver (cached) ─────────────────────────────
// Every Tier 2/3 DB links to DB-A via a Project *relation*. To filter by
// project we first need that project's DB-A page ID. We build a map of
// { name: pageId } once and reuse it for the rest of the session.
let _projectIndex = null;
let _projectIndexAt = 0;
const PROJECT_INDEX_TTL_MS = 5 * 60 * 1000;

// Normalize a project name for fuzzy matching:
//   "H2R — Maison Margiela Residence" -> "h2r maison margiela residence"
//   "H2R_ALTA Maison Margiela Residences" -> "h2r alta maison margiela residences"
// Strips punctuation/dashes/underscores, collapses whitespace.
function normalizeProjectName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[—–_\-\(\)]/g, ' ')   // em-dash, en-dash, underscore, hyphen, parens → space
    .replace(/[^a-z0-9\s]/g, ' ')    // any remaining punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

async function getProjectIndex() {
  const dbId = listEnvDbs().projects;
  if (!dbId) return new Map();
  if (_projectIndex && Date.now() - _projectIndexAt < PROJECT_INDEX_TTL_MS) {
    return _projectIndex;
  }
  // Map: normalized name → { id, tokens: Set<token> }
  const map = new Map();
  let cursor;
  try {
    do {
      const resp = await notion.databases.query({
        database_id: dbId, page_size: 100, start_cursor: cursor,
      });
      for (const r of resp.results) {
        const title = (r.properties?.Name?.title || r.properties?.['Project Name']?.title || [])[0]?.plain_text;
        if (title) {
          const norm = normalizeProjectName(title);
          map.set(norm, { id: r.id, tokens: new Set(norm.split(' ')), original: title });
        }
      }
      cursor = resp.has_more ? resp.next_cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.warn('Project index build failed:', e.message);
  }
  _projectIndex = map;
  _projectIndexAt = Date.now();
  return map;
}

// Explicit alias map for app-side project names that don't fuzzy-match any
// Notion DB-A title. The key is the *app* name (case-insensitive), the value
// is the target Notion title (must match DB-A exactly after normalization).
const PROJECT_ALIASES = {
  'metro project mep':      'mng',
  'metro project':          'mng',
  'data center mep':        'alemco data centre',
  'data centre mep':        'alemco data centre',
  'admin building mep':     'alemco admin building',
  'admin bldg':             'alemco admin building',
  'dar project':            'dar mep resourcing',
  'dar':                    'dar mep resourcing',
  'abaad wood — joinery shop drawings': 'abaad wood the grove ph 02',
  'abaad wood':             'abaad wood the grove ph 02',
};

// Resolves any project-name variant ("H2R" / "H2R_ALTA Maison Margiela Residences"
// / "H2R — Maison Margiela Residence") to the correct DB-A page ID.
async function resolveProjectPageId(projectName) {
  if (!projectName) return null;
  const idx = await getProjectIndex();
  if (idx.size === 0) return null;

  const keyNorm = normalizeProjectName(projectName);

  // 0) Explicit alias check FIRST — highest priority
  const aliasLookup = PROJECT_ALIASES[keyNorm] || PROJECT_ALIASES[projectName.toLowerCase().trim()];
  if (aliasLookup && idx.has(aliasLookup)) return idx.get(aliasLookup).id;

  // 1) Exact normalized match
  if (idx.has(keyNorm)) return idx.get(keyNorm).id;

  const keyTokens = new Set(keyNorm.split(' '));
  const firstToken = keyNorm.split(' ')[0] || '';

  // 2) Substring either way (post-normalization)
  for (const [name, info] of idx) {
    if (name.includes(keyNorm) || keyNorm.includes(name)) return info.id;
  }

  // 3) Token overlap — Jaccard-like score, pick best if ≥ 0.4 similarity.
  let best = { score: 0, id: null };
  for (const [, info] of idx) {
    const inter = [...info.tokens].filter(t => keyTokens.has(t)).length;
    const union = new Set([...info.tokens, ...keyTokens]).size;
    const score = union > 0 ? inter / union : 0;
    if (score > best.score) best = { score, id: info.id };
  }
  if (best.score >= 0.4) return best.id;

  // 4) First-token exact match (e.g. "H2R" alone) as final fallback.
  for (const [, info] of idx) {
    if (info.tokens.has(firstToken) && firstToken.length >= 2) return info.id;
  }
  return null;
}

// Build a Notion filter for the Project *relation* field. Returns null if we
// can't resolve the project — callers should fall back to returning no rows.
async function projectRelationFilter(projectName, fieldName = 'Project') {
  if (!projectName) return null;
  const pageId = await resolveProjectPageId(projectName);
  if (!pageId) return { _noMatch: true };
  return { property: fieldName, relation: { contains: pageId } };
}

// ── TIER 1 ───────────────────────────────────────────────────────────────────
async function fetchProjects() {
  const db = listEnvDbs().projects;
  const rows = await _queryAll(db);
  return rows.map(r => {
    const p = r.properties;
    return {
      id:           r.id,
      name:         title(p, 'Name') || title(p, 'Project Name'),
      code:         text(p, 'Code') || sel(p, 'Code'),
      status:       sel(p, 'Status'),
      billingModel: sel(p, 'Billing Model'),
      client:       text(p, 'Client'),
      location:     sel(p, 'Location'),
      disciplines:  multi(p, 'Discipline'),
      progress:     num(p, 'Progress %'),
      contractValue: num(p, 'Contract Value'),
    };
  });
}

async function fetchPeople() {
  const rows = await _queryAll(listEnvDbs().people);
  return rows.map(r => {
    const p = r.properties;
    return {
      name:       title(p, 'Employee Name') || title(p, 'Name'),
      designation: sel(p, 'Designation'),
      discipline:  sel(p, 'Discipline'),
      department:  sel(p, 'Department'),
      location:    sel(p, 'Location'),
      status:      sel(p, 'Status'),
      lastProject: text(p, 'Last Project'),
    };
  });
}

// ── TIER 2 ───────────────────────────────────────────────────────────────────
async function fetchDeliverables(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().deliverables, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      drawingNo: text(p, 'Drawing Number') || title(p, 'Name') || title(p, 'Drawing Title'),
      title:     title(p, 'Name') || title(p, 'Drawing Title'),
      lod:       sel(p, 'LOD Stage'),
      status:    sel(p, 'Approval Status'),
      submittedDate: date(p, 'Actual Submission Date'),
      approvedDate:  date(p, 'Approved Date'),
      plannedDate: date(p, 'Planned Submission Date'),
      discipline: sel(p, 'Discipline'),
      zone:       text(p, 'Zone / Location') || text(p, 'Zone/Location'),
      remarks:    text(p, 'Remarks'),
    };
  });
}

async function fetchSchedule(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().schedule, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      milestone:   title(p, 'Name') || title(p, 'Milestone Title') || title(p, 'Milestone'),
      plannedDate: date(p, 'Planned Date') || date(p, 'Target Date'),
      actualDate:  date(p, 'Actual Date'),
      plannedPct:  num(p, 'Planned %') ?? num(p, 'Weight %'),
      actualPct:   num(p, 'Actual %')  ?? num(p, 'Completion %'),
      status:      sel(p, 'Status'),
      phase:       sel(p, 'Phase'),
    };
  });
}

async function fetchIssues(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().issues, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      ref:        title(p, 'Name') || title(p, 'Issue Title'),
      type:       sel(p, 'Type'),
      status:     sel(p, 'Status'),
      severity:   sel(p, 'Priority'),
      raisedDate: date(p, 'Raised Date'),
      dueDate:    date(p, 'Due Date'),
      resolvedDate: date(p, 'Resolved Date'),
      description: text(p, 'Description'),
      resolution:  text(p, 'Resolution'),
      zone:        text(p, 'Zone/Location'),
    };
  });
}

async function fetchInputs(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().inputs, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      item:         title(p, 'Name') || title(p, 'Input Description') || title(p, 'Item'),
      type:         sel(p, 'Input Type'),
      status:       sel(p, 'Status'),
      dueDate:      date(p, 'Expected Date') || date(p, 'Requested Date'),
      receivedDate: date(p, 'Received Date'),
      responsible:  text(p, 'Source'),
      blocking:     check(p, 'Blocking'),
      discipline:   sel(p, 'Discipline'),
    };
  });
}

async function fetchComms(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().comms, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      ref:       title(p, 'Name') || title(p, 'Subject'),
      type:      sel(p, 'Comm Type') || sel(p, 'Type'),
      direction: sel(p, 'Direction'),
      date:      date(p, 'Date'),
      subject:   title(p, 'Name') || text(p, 'Subject'),
      status:    sel(p, 'Status'),
    };
  });
}

async function fetchDocuments(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().documents, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      docNo:    text(p, 'Doc Number') || title(p, 'Name') || title(p, 'Document Title'),
      title:    title(p, 'Name') || title(p, 'Document Title'),
      category: sel(p, 'Category') || sel(p, 'Type'),
      revision: text(p, 'Revision'),
      date:     date(p, 'Date'),
    };
  });
}

async function fetchModelUpdates(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().modelUpdates, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      revision: title(p, 'Name') || title(p, 'Revision'),
      date:     date(p, 'Date') || date(p, 'Update Date'),
      author:   text(p, 'Author'),
      summary:  text(p, 'Summary') || text(p, 'Description') || text(p, 'Affected Elements'),
    };
  });
}

// ── TIER 3 ───────────────────────────────────────────────────────────────────
async function fetchCommercial(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().commercial, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      invoiceNo:  text(p, 'Invoice No') || title(p, 'Name'),
      status:     sel(p, 'Status'),
      amount:     num(p, 'Net Payable') ?? num(p, 'Amount'),
      issuedDate: date(p, 'Issue Date') || date(p, 'Issued Date'),
      paidDate:   date(p, 'Paid Date'),
    };
  });
}

async function fetchManmonths(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().manmonths, f);
  return rows.map(r => {
    const p = r.properties;
    const budgeted = num(p, 'Budgeted Manmonths');
    const consumed = num(p, 'Consumed This Month');
    return {
      employee:     title(p, 'Name') || text(p, 'Employee Name'),
      month:        date(p, 'Month'),
      plannedHours: budgeted != null ? budgeted * 160 : num(p, 'Planned Hours'),
      actualHours:  consumed != null ? consumed * 160 : num(p, 'Actual Hours'),
      efficiency:   num(p, 'Burn Rate %') ?? num(p, 'Efficiency %'),
    };
  });
}

async function fetchVariations(projectName) {
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().variations, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      variationId:    title(p, 'Name') || title(p, 'Variation ID'),
      status:         sel(p, 'Status'),
      reason:         sel(p, 'Reason'),
      costImpact:     num(p, 'Cost Impact'),
      timeImpactDays: num(p, 'Time Impact (days)'),
      raisedDate:     date(p, 'Raised Date'),
    };
  });
}

async function fetchKPI(filter) {
  const rows = await _queryAll(listEnvDbs().kpi, filter);
  return rows.map(r => {
    const p = r.properties;
    return {
      staffName: text(p, 'Staff Name'),
      project:   sel(p, 'Project'),
      kpiType:   sel(p, 'KPI Type'),
      kpiValue:  num(p, 'KPI Value'),
      dayStatus: sel(p, 'Day Status'),
      date:      date(p, 'Date'),
    };
  });
}

async function fetchTimesheets(projectName) {
  // v2 DB-12 Timesheets uses Project as a relation
  const f = await projectRelationFilter(projectName);
  const rows = await _queryAll(listEnvDbs().timesheets, f);
  return rows.map(r => {
    const p = r.properties;
    return {
      employee: text(p, 'Employee') || title(p, 'Name'),
      date:     date(p, 'Date'),
      hours:    num(p, 'Hours'),
      task:     text(p, 'Task'),
      billable: check(p, 'Billable'),
      status:   sel(p, 'Status'),
    };
  });
}

// ── Bulk loader ──────────────────────────────────────────────────────────────
// Pulls everything relevant to a query in parallel. Intent flags tell us which
// DBs to actually hit — most chat turns only need 2 or 3, not all 15.
async function fetchRelevant({ projectName, wants = {} } = {}) {
  const tasks = {};
  if (wants.projects)      tasks.projects      = fetchProjects();
  if (wants.people)        tasks.people        = fetchPeople();
  if (wants.deliverables)  tasks.deliverables  = fetchDeliverables(projectName);
  if (wants.schedule)      tasks.schedule      = fetchSchedule(projectName);
  if (wants.issues)        tasks.issues        = fetchIssues(projectName);
  if (wants.inputs)        tasks.inputs        = fetchInputs(projectName);
  if (wants.comms)         tasks.comms         = fetchComms(projectName);
  if (wants.documents)     tasks.documents     = fetchDocuments(projectName);
  if (wants.modelUpdates)  tasks.modelUpdates  = fetchModelUpdates(projectName);
  if (wants.commercial)    tasks.commercial    = fetchCommercial(projectName);
  if (wants.manmonths)     tasks.manmonths     = fetchManmonths(projectName);
  if (wants.variations)    tasks.variations    = fetchVariations(projectName);
  if (wants.kpi)           tasks.kpi           = fetchKPI();
  if (wants.timesheets)    tasks.timesheets    = fetchTimesheets(projectName);

  const entries = await Promise.all(Object.entries(tasks).map(
    async ([k, p]) => [k, await p]
  ));
  return Object.fromEntries(entries);
}

module.exports = {
  fetchProjects, fetchPeople,
  fetchDeliverables, fetchSchedule, fetchInputs, fetchIssues,
  fetchComms, fetchDocuments, fetchModelUpdates,
  fetchCommercial, fetchManmonths, fetchVariations,
  fetchKPI, fetchTimesheets,
  fetchRelevant,
  listEnvDbs,
};
