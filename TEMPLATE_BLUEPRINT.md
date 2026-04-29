# Live Operations Tracker — Web App Template Blueprint

> A reusable blueprint for building a **live operations tracker** web app
> backed by **Notion** (as structured DB), **Google Sheets** (as live feed), and
> a **conversational AI chatbot** — based on the JES BIM Operations AI build.

---

## 1. What this template delivers

A single-page web app that gives operations / PM teams:

- **Live dashboard** — KPI cards, project list, status pills, click-to-filter
- **Project 360° modal** — one click on a project name opens a modal that pulls
  every related record from 14+ Notion databases (deliverables, RFIs, invoices,
  variations, timesheets, KPI, manmonths — all filtered by the clicked project)
- **Resources tab** — employee directory with Active / Unallocated / Archive
  status, inline edit, add-new, filters by team/location/discipline
- **Report generation** — PDF + Excel outputs for 15+ report templates
  (progress reports, KPI reports, invoices, manmonth efficiency, etc.)
- **AI chatbot** — natural-language queries across all connected data sources
  (Claude Sonnet 4.6 or equivalent). Examples:
    - "Show me H2R's open RFIs"
    - "Which projects are at risk?"
    - "Generate April progress report for Orla Towers"
- **Live Google Sheets sync** — pulls weekly resource allocation from Sheets
  (optional, requires public sharing or API key)
- **Folder → Notion pipeline** — one-command script that walks a master folder
  tree and pushes metadata into Notion

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                                  │
│  Single-page HTML + vanilla JS (public/index.html)                       │
│  - Auth screen, dashboard, chat panel, modals, charts                    │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ fetch()
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 VERCEL SERVERLESS API (Node 18+)                         │
│                                                                           │
│  /api/auth/*           — login / signup (JWT)                            │
│  /api/chat             — Claude-powered chat (intent detection + RAG)    │
│  /api/data/projects    — live projects feed                              │
│  /api/data/resources   — live resources feed (Sheets → JSON → Notion)    │
│  /api/data/project-detail?name=X  — full 360° aggregation                │
│  /api/data/_notionDbs  — unified query layer for 14+ Notion DBs          │
│  /api/data/_googleSheets — public-sheet CSV fetcher                      │
│  /api/reports/generate — AI-assembled report content                     │
│  /api/reports/pdf      — jsPDF PDF rendering with brand theme            │
│  /api/reports/excel    — SheetJS xlsx rendering                          │
│  /api/reports/master   — Master Template Pack PDF router                 │
└──────────────────────┬───────────────────────┬──────────────────────────┘
                       │                       │
                       ▼                       ▼
              ┌─────────────────┐      ┌─────────────────────┐
              │     NOTION      │      │   GOOGLE SHEETS     │
              │  (14+ linked    │      │  (public CSVs via   │
              │   databases)    │      │   REST API key)     │
              └─────────────────┘      └─────────────────────┘
```

---

## 3. Tech stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Vanilla HTML + JS (single file) | No framework = easy to customize, ship, and deploy |
| Backend | Vercel serverless (Node 18+) | Zero-ops, auto-scale, native `fetch` |
| Framework | Next.js 16 shell | Only used for routing/SSR — the real app is `public/index.html` |
| AI | Claude Sonnet 4.6 via Anthropic API | Strong reasoning, tool use |
| Structured DB | Notion (DB-A through DB-12) | Non-technical users can edit, has relations, rich views |
| Live feed | Google Sheets (CSV export) | Teams already use Sheets weekly, zero migration |
| Auth | JWT (jsonwebtoken) | Stateless, simple; users defined in env vars |
| Styling | Inline styles + small CSS block | No Tailwind compiler needed |
| Charts | Chart.js | Lightweight, good enough |
| PDF | jsPDF + jsPDF-autotable | Programmatic PDF with branded tables |
| Excel | SheetJS (xlsx) | Generates .xlsx from JSON |

---

## 4. Notion database model (the data spine)

**Tier 1 — Master Registers** (company-wide, one record per entity)
- **DB-A Projects Master** — Name, Code, Billing Model, Status, Progress, Disciplines, Contract Value
- **DB-B People & Resources** — Employee, Designation, Discipline, Location, Last Project
- **DB-C Clients & Contacts**

**Tier 2 — Production Tracking** (per-project records, all link to DB-A)
- **DB-1 Deliverables Register** — drawings, LOD Stage, Approval Status, dates
- **DB-2 Schedule & Milestones** — planned vs actual %
- **DB-3 Inputs & Prerequisites** — client-provided drawings, material submittals
- **DB-4 RFI / Issues / Clash Tracker** — issue title, type, severity, status
- **DB-5 Communications & Submissions** — emails, MOMs, transmittals
- **DB-6 Document Register** — BEP, MIDP, execution plans
- **DB-7 Model Updates Log** — revisions, model changes

**Tier 3 — Commercial & Performance** (per-project or per-month)
- **DB-8 Commercial & Invoicing** — PA claims, invoices
- **DB-9 Manmonth Consumption Tracker** — planned vs actual hours
- **DB-10 Variation Register** — change orders, cost/time impact
- **DB-11 KPI Dashboard** — individual staff performance scores
- **DB-12 Timesheet Register** — daily time entries for resourcing projects

**Key design decisions:**
1. **Every Tier 2/3 DB has a `Project` relation** back to DB-A — this makes
   "give me everything for Project X" a single filter query per DB.
2. **`Billing Model` field on DB-A** drives plugin routing — Lump Sum vs
   Resourcing reports pull different fields and calculation logic.
3. **Title properties vary by DB** — "Drawing Title", "Issue Title",
   "Input Description", etc. The reader layer handles this.

---

## 5. File structure

```
your-app/
├── api/                             # Vercel serverless functions
│   ├── auth/
│   │   ├── login.js                 # POST /api/auth/login
│   │   └── signup.js
│   ├── chat.js                      # POST /api/chat — AI chatbot
│   ├── data/
│   │   ├── _notionDbs.js            # Unified Notion query layer
│   │   ├── _googleSheets.js         # Public-sheet CSV fetcher
│   │   ├── projects.js              # GET /api/data/projects
│   │   ├── resources.js             # GET /api/data/resources
│   │   └── project-detail.js        # GET /api/data/project-detail?name=X
│   └── reports/
│       ├── generate.js              # AI report content generator
│       ├── pdf.js                   # jsPDF renderer with brand theme
│       ├── excel.js                 # xlsx exporter
│       └── master.js                # Master Template Pack router
├── public/
│   ├── index.html                   # THE APP (UI + state + logic)
│   ├── projects_data.json           # Fallback projects data
│   └── resources_data.json          # Fallback resources snapshot
├── scripts/
│   ├── import-from-folders.js       # Folder → Notion bulk importer
│   └── set-vercel-env.ps1           # One-command env var setup
├── .env.example                     # Env var template
├── package.json
└── vercel.json
```

---

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# AI
CLAUDE_API_KEY=sk-ant-api03-xxxxx

# Auth
JWT_SECRET=<random 32+ char string>
ADMIN_EMAIL=admin@your-co.com
ADMIN_PASSWORD=<bcrypt hash or plain for dev>
ADMIN_NAME=Admin User

# Notion (token + 15 DB IDs)
NOTION_TOKEN=secret_xxxxx
NOTION_PROJECTS_DB=<32-char DB ID>
NOTION_PEOPLE_DB=...
NOTION_CLIENTS_DB=...
NOTION_DELIVERABLES_DB=...
NOTION_SCHEDULE_DB=...
NOTION_INPUTS_DB=...
NOTION_ISSUES_DB=...
NOTION_COMMS_DB=...
NOTION_DOCUMENTS_DB=...
NOTION_MODEL_UPDATES_DB=...
NOTION_COMMERCIAL_DB=...
NOTION_MANMONTHS_DB=...
NOTION_VARIATIONS_DB=...
NOTION_KPI_DB=...
NOTION_TIMESHEETS_DB=...

# Google Sheets (optional — enables live resource sync)
GOOGLE_SHEETS_API_KEY=AIzaXXX
```

---

## 7. The "Project 360° modal" pattern (core innovation)

A user clicks a project name → one modal opens showing **every record from every connected DB filtered to that project**. The magic is in 3 layers:

**Layer 1: Project name resolver** (`api/data/_notionDbs.js`)

```js
// Cached map of project-name → DB-A page ID
let _projectIndex = null;

async function resolveProjectPageId(projectName) {
  const idx = await getProjectIndex();            // builds once, caches 5 min
  const keyNorm = normalizeProjectName(projectName);

  // 0) Explicit alias (e.g. "Metro Project MEP" → "mng")
  if (PROJECT_ALIASES[keyNorm]) return idx.get(PROJECT_ALIASES[keyNorm]).id;

  // 1) Exact normalized match
  if (idx.has(keyNorm)) return idx.get(keyNorm).id;

  // 2) Substring match either direction
  for (const [n, info] of idx) if (n.includes(keyNorm) || keyNorm.includes(n)) return info.id;

  // 3) Jaccard token overlap ≥ 0.4
  // 4) First-token fallback
}
```

**Layer 2: Parallel aggregator** (`api/data/project-detail.js`)

```js
const notionData = await notionDbs.fetchRelevant({
  projectName,
  wants: { deliverables:true, schedule:true, issues:true, inputs:true,
           comms:true, documents:true, modelUpdates:true,
           commercial:true, manmonths:true, variations:true,
           kpi:true, timesheets:true },
});
// All 13 DBs queried in parallel, each uses projectRelationFilter()
return { project, summary, team, ...notionData };
```

**Layer 3: Modal renderer** (`public/index.html` → `openProjectDetail()`)

Renders 13 collapsible sections. "No records" placeholder if a section is
empty so the user knows the DB is connected but has no data yet.

---

## 8. Intent-driven chatbot (`api/chat.js`)

The chatbot doesn't blindly dump all data into Claude's context. It runs a
regex-based intent detector first, then fetches **only** the DBs relevant to
the question.

```js
function detectIntent(message) {
  return {
    mentionedProject: aliasMatch(message, PROJECT_ALIASES),
    isDeliverableQuery:  /\b(drawing|lod|submission)\b/.test(m),
    isRfiQuery:          /\b(rfi|issue|clash)\b/.test(m),
    isVariationQuery:    /\b(variation|change order|vo )\b/.test(m),
    isMMQuery:           /\b(man.?month|mm|budget|burn)\b/.test(m),
    // ... 10 more intents
  };
}

// Only fetch the DBs matching the intent
const wants = {
  deliverables: intent.isDeliverableQuery,
  issues: intent.isRfiQuery || intent.isRiskQuery,
  // ...
};
const notionData = await notionDbs.fetchRelevant({ projectName, wants });
```

This keeps chat turn latency under ~2 seconds even when the project has
thousands of records across 14 DBs.

---

## 9. Folder → Notion bulk import pipeline

For teams with **existing folder trees of drawings / documents / emails**, the
script at `scripts/import-from-folders.js` walks a directory like:

```
MASTER REGISTERS/
  H2R_Arch/
    TIER_2_PRODUCTION_TRACKING/
      DB-1_Deliverables_Register/
        LOD_200_Input/
          03-12-2025_(wall finishes)/
            2BDR - Wall Finishes.pdf
```

…and creates one Notion row per file, auto-extracting:
- **Drawing title** from file name
- **LOD Stage + Approval Status** from the stage folder (`LOD_200_Input` → `LOD 300 Input` + `Not Submitted`)
- **Submission Date** from date folder (`03-12-2025` → `2025-12-03`)
- **Project relation** resolved via DB-A title match (with alias table for odd folder names)
- **Discipline** inferred from folder suffix (`_Arch` / `_MEP`)

Features:
- **Idempotent** — queries existing `(project_id, title)` pairs and skips dupes
- **Rate-limited** (250ms per Notion API call)
- **Dry-run mode** — `--dry-run` previews without writing
- **Per-project filter** — `--project "H2R"` for targeted runs
- **Configurable LIMIT per DB** to cap any run's max records

Run once on your desktop:
```powershell
node scripts/import-from-folders.js --root "D:\MASTER REGISTERS" --limit 500
```

Output:
```
════ H2R ════════════════════════════
[DB-1 Deliverables] H2R — 47 files
  (Building DB-A Projects index...)
  (Indexed 18 projects)
..........................---
[DB-3 Inputs] H2R — 12 files
............
✔ Done.
   Created: 58  |  Skipped (dup): 3  |  Failed: 0
```

---

## 10. Google Sheets live-sync pattern

For data that lives in Sheets (weekly resource allocation, attendance logs):

```js
// api/data/_googleSheets.js
async function fetchRange(sheetId, range) {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${key}&valueRenderOption=FORMATTED_VALUE`;
  const resp = await fetch(url);
  return (await resp.json()).values || [];
}

// Cache 5 minutes so repeat requests don't hammer the Sheets API
let _cache = null, _cacheAt = 0;
async function fetchAllLive({ force = false } = {}) {
  if (!force && _cache && Date.now() - _cacheAt < 5 * 60 * 1000) return _cache;
  const [arch, mep] = await Promise.all([fetchArchResources(), fetchMepResources()]);
  _cache = { arch, mep };
  _cacheAt = Date.now();
  return _cache;
}
```

**Current-week logic:** if the sheet has weekly columns like
`April week 4 (19-25)`, the fetcher detects today's date and picks the matching
column as `current_project`.

---

## 11. Customizing for a new domain

To retarget this template for (say) a **Marketing Operations Hub** or **HR
Operations Hub**, you mostly swap names and ignore things:

| Current (BIM) | Marketing | HR |
|---|---|---|
| Projects Master | Campaigns | Hiring Pipelines |
| Deliverables | Creative Assets | Job Requisitions |
| RFIs | Approval Requests | Interview Feedback |
| Manmonths | Budget Burn | Headcount Plan |
| Variations | Scope Changes | Req. Changes |
| Timesheets | Time Entries | Time-off Requests |

Steps:
1. **Rename the 14 Notion DBs** in your workspace
2. **Update `.env` with new IDs** (run the PowerShell setup script)
3. **Edit `_notionDbs.js`** field mapping if property names differ
4. **Update the Project 360° modal section titles** in `index.html`
5. **Adjust intent regex** in `api/chat.js` for your domain vocabulary
6. **Swap the brand theme** in `api/reports/pdf.js` (banner color, fonts)

---

## 12. Deployment

```bash
# First time
npm i -g vercel
vercel link                         # connect to a new Vercel project
vercel env add NOTION_TOKEN         # paste value when prompted
# ... repeat for all env vars (or use the PowerShell bulk script)

# Deploy
vercel --prod
# → https://your-app.vercel.app
```

---

## 13. Known limitations / future work

- **Edits are localStorage-only** — no server persistence yet. Add PATCH
  endpoints that write back to Notion (`notion.pages.update`).
- **No search across records** — Project 360° shows ≤25 rows per section.
  Add paging or lazy-loading.
- **Static project list** — if you add a new project in Notion, it won't
  appear in the dashboard until you redeploy (projects_data.json is a static
  fallback). Wire `api/data/projects.js` to live-query DB-A.
- **Single-tenant** — one set of env vars serves all users. For multi-tenant
  (multiple companies using the same app), add a tenant field.
- **No audit trail** — who edited what and when isn't logged.

---

## 14. Proven track record

This template is derived from the **JES BIM Operations AI** production app:
- **13 projects tracked** across Arch + MEP disciplines
- **277 employees** (Arch + MEP) with live status/allocation
- **15 Notion databases** connected and queryable
- **7 report templates** matching the JES BIM Master Template Pack v1.0
- **Deployed on Vercel** at jes-bim-ai.vercel.app

---

**Author:** JES BIM Operations team + Claude (Cowork mode)
**License:** Internal use
**Last updated:** 2026-04-22
