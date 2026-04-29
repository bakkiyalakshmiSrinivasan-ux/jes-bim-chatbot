# JES BIM Operations — SSOT Hub v2 Schema Spec

**Built:** 2026-04-22
**Parent page:** `3502d6b7-290f-81d2-be0c-c52ed229c7ad` (in same workspace)
**Reason for v2:** v1 had inconsistent property names, missing standard fields, and wrong select options.

---

## Cross-DB conventions (NEW in v2)

Every database in v2 has these **standard fields**:

| Field | Type | Purpose |
|---|---|---|
| `Name` (or domain-specific title) | title | Primary identifier |
| `Tags` | multi_select | Free-form classification |
| `Notes` | rich_text | Long-form notes |
| `Created` | created_time | Auto |
| `Last Edited` | last_edited_time | Auto |
| `Created By` | person | Auto |

**Unified Discipline values** (used in every DB that has one):
- Architectural · MEP - Electrical · MEP - Mechanical · MEP - Plumbing · Structural · Coordination · ID & Joinery

**Unified Status pattern**: `Active / In Progress / Pending / Completed / Cancelled` with DB-specific extras

**Unified Priority**: `Critical / High / Medium / Low`

---

## Build status

| DB | Title | Status | Database ID | Data Source ID |
|---|---|---|---|---|
| DB-A | Projects Master | ✅ Built | `ee55983748e64b5382823ab5d1a0a192` | `e5a045f7-2b02-4e5a-aa3b-e28516d32a11` |
| DB-B | People & Resources | ✅ Built | `57cfd1f84a654c7dbe0448f07cd12725` | `6b091bb1-d8ec-4cfb-912b-98ee7544089e` |
| DB-C | Clients & Contacts | ⏳ Pending | — | — |
| DB-1 | Deliverables Register | ⏳ Pending | — | — |
| DB-2 | Schedule & Milestones | ⏳ Pending | — | — |
| DB-3 | Inputs & Prerequisites | ⏳ Pending | — | — |
| DB-4 | RFIs / Issues / Clashes | ⏳ Pending | — | — |
| DB-5 | Communications & Submissions | ⏳ Pending | — | — |
| DB-6 | Document Register | ⏳ Pending | — | — |
| DB-7 | Model Updates Log | ⏳ Pending | — | — |
| DB-8 | Commercial & Invoicing | ⏳ Pending | — | — |
| DB-9 | Manmonth Consumption | ⏳ Pending | — | — |
| DB-10 | Variation Register | ⏳ Pending | — | — |
| DB-11 | KPI Dashboard | ⏳ Pending | — | — |
| DB-12 | Timesheet Register | ⏳ Pending | — | — |

---

## DB-A: Projects Master — BUILT ✅

**Title:** `Name` (was: `Name` — unchanged)

| Field | Type | Options / Notes |
|---|---|---|
| Name | title | The project name |
| Code | unique_id PRJv2 | Auto-numbered |
| Status | select | Active / On Hold / Completed / Cancelled / Kickoff / Closeout |
| Billing Model | select | Lump Sum / Resourcing / Hybrid |
| Stage | select | Kickoff / Coordination / Modeling / Submission / Approved / Handover / Closed |
| Disciplines | multi_select | Architectural / MEP-Electrical / MEP-Mechanical / MEP-Plumbing / Structural / Coordination / ID & Joinery |
| Client | rich_text | Free text |
| Location | select | Dubai / Abu Dhabi / Riyadh / Other UAE / Other KSA / Chennai / Trichy / Other India |
| Country | select | UAE / Saudi Arabia / India / Qatar / Other |
| Contract Value | number | AED |
| Currency | select | AED / USD / INR / SAR / EUR |
| Start Date / Planned End / Actual End | date | |
| Progress % | number (percent) | |
| Team Size | number | |
| Manmonths Budgeted / Used | number | |
| Risk Level | select | Low / Medium / High / Critical |
| Project Manager | rich_text | |
| BIM Lead | rich_text | |
| Tags | multi_select | VIP / Strategic / Pilot / New Client / Repeat Client / Government / Private |
| Notes | rich_text | |
| Created / Last Edited / Created By | auto | |

**Changes from v1:** Added Risk Level, BIM Lead, Tags, Country, Stage, standard fields.

---

## DB-B: People & Resources — BUILT ✅

**Title:** `Name`

| Field | Type | Options |
|---|---|---|
| Name | title | Employee name |
| Employee ID | unique_id EMPv2 | Auto |
| Status | select | Active / On Leave / Inactive / Resigned / Notice Period |
| Discipline | select | Architectural / MEP-Electrical / MEP-Mechanical / MEP-Plumbing / Structural / Coordination / Management / Admin |
| Designation | select | 14 designations (Operations Mgr, PM, BIM Lead, Sr. Coordinator, Coordinator, Sr. Modeler, Modeler, Jr. Modeler, Intern, Software Dev, Document Controller, IT/Admin, HR, Accounts) |
| Team | select | Hari / Ramya / Sivaji / Jai Prakash / Charu / DAR Management / MEP Coordination / N/A |
| Location | select | Chennai / Trichy / Dubai / Riyadh / Other |
| Email | email | |
| Phone | phone_number | |
| Manager | rich_text | |
| Joining Date | date | |
| Last Project | relation → DB-A | Links to current/last project |
| Current Allocation | select | On Project / Internal / Bench / Training / Leave |
| Skills | multi_select | Revit / AutoCAD / Navisworks / Dynamo / BIM 360 / Solibri / Tekla / ETABS |
| Tags | multi_select | Onboarding / Trainee / Senior / Top Performer |
| Notes, Created, Last Edited, Created By | standard | |

**Changes from v1:** Renamed `Last Project` from text → proper relation to DB-A. Cleaned status options. Added Skills, Tags, Joining Date.

---

## DB-C: Clients & Contacts — Planned

**Title:** `Company Name`

| Field | Type | Notes |
|---|---|---|
| Company Name | title | Client / consultant company |
| Contact ID | unique_id CLI | |
| Type | select | Client / Consultant / Architect / Contractor / Subcontractor / Authority |
| Status | select | Active / Inactive / Prospect |
| Country / Location | select | UAE / KSA / etc. |
| Primary Contact | rich_text | |
| Email / Phone / Website | email/phone/url | |
| Active Projects | relation → DB-A | |
| Tier | select | Tier 1 (strategic) / Tier 2 (regular) / Tier 3 (occasional) |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-1: Deliverables Register — Planned

**Title:** `Name` (formerly `Drawing Title`)

| Field | Type | Options |
|---|---|---|
| Name | title | Drawing / deliverable name |
| Drawing Number | rich_text | |
| Project | relation → DB-A | |
| Discipline | select | Standard discipline list |
| LOD Stage | select | LOD 100 / LOD 200 / LOD 300 / LOD 400 / LOD 500 / Submitted / Approved (FIXED — v1 was missing LOD 200) |
| Approval Status | select | Not Submitted / Submitted / Under Review / Approved / Approved with Comments / Rejected / Resubmit |
| Planned Submission Date | date | |
| Actual Submission Date | date | |
| Approved Date | date | |
| Completion % | number (percent) | |
| Revision Number | rich_text | |
| Zone / Location | rich_text | |
| Assigned To | relation → DB-B | |
| Reviewed By | relation → DB-B | |
| Linked RFIs | relation → DB-4 | |
| Tags / Remarks / Created / Last Edited / Created By | standard | |

---

## DB-2: Schedule & Milestones — Planned

**Title:** `Name` (formerly `Milestone`)

| Field | Type | Options |
|---|---|---|
| Name | title | Milestone name |
| Project | relation → DB-A | |
| Phase | select | Design / Coordination / Submission / Approval / Handover |
| Planned Date | date | |
| Actual Date | date | |
| Planned % | number (percent) | Weight in overall progress |
| Actual % | number (percent) | Achieved completion |
| Variance | formula | `prop("Actual %") - prop("Planned %")` |
| Status | select | Not Started / In Progress / Achieved / Delayed / At Risk |
| Owner | relation → DB-B | |
| Dependencies | rich_text | |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-3: Inputs & Prerequisites — Planned

**Title:** `Name` (formerly `Input Description`)

| Field | Type | Options |
|---|---|---|
| Name | title | Input description |
| Project | relation → DB-A | |
| Input Type | select | Reference Model / Design Drawing / Specification / Shop Drawing Template / BEP Standards / RFI Response / Client Approval / Material Submittal / Single Line Diagram / Room Matrix / Typical Detail / Asset Data Template |
| Discipline | select | Standard list |
| Status | select | Not Requested / Requested / Received / Partial / Overdue / N/A |
| Requested Date / Expected Date / Received Date | date | |
| Source | rich_text | Where it came from (client/consultant) |
| Blocking | checkbox | Is this blocking other work? |
| Blocked Drawings | relation → DB-1 | |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-4: RFIs / Issues / Clashes — Planned

**Title:** `Name` (formerly `Issue Title`)

| Field | Type | Options |
|---|---|---|
| Name | title | Issue title |
| Issue ID | unique_id RFI | |
| Project | relation → DB-A | |
| Type | select | RFI / Hard Clash / Soft Clash / Design Issue / Missing Info / Scope Change / Query |
| Status | select | Open / In Progress / Pending Client / Pending Consultant / Resolved / Closed |
| Priority | select | Critical / High / Medium / Low |
| Discipline | multi_select | Multiple disciplines may be affected |
| Raised By | relation → DB-B | |
| Assigned To | relation → DB-B | |
| Raised Date / Due Date / Resolved Date | date | |
| Days Open | formula | Days since Raised Date until Resolved or today |
| Linked Drawings | relation → DB-1 | |
| Description | rich_text | |
| Resolution | rich_text | |
| Tags / Created / Last Edited / Created By | standard | |

---

## DB-5: Communications & Submissions — Planned

**Title:** `Name` (formerly `Subject` or `Ref`)

| Field | Type | Options |
|---|---|---|
| Name | title | Subject |
| Project | relation → DB-A | |
| Comm Type | select | Email / Letter / MOM / Phone Call / Teams Message / Transmittal / WhatsApp |
| Direction | select | Incoming / Outgoing / Internal |
| Date | date | |
| From | rich_text | |
| To | rich_text | |
| Linked Issues | relation → DB-4 | |
| Linked Drawings | relation → DB-1 | |
| Status | select | Open / Awaiting Reply / Replied / Closed |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-6: Document Register — Planned

**Title:** `Name` (formerly `Document Title`)

| Field | Type | Options |
|---|---|---|
| Name | title | Document title |
| Doc Number | rich_text | |
| Project | relation → DB-A | |
| Category | select | BEP / MIDP / Execution Plan / Kickoff Document / Material Submittal / Asset Data / LPO / Meeting Notes / Monthly Report / Org Chart |
| Revision | rich_text | |
| Status | select | Draft / Issued / Approved / Superseded |
| Date | date | |
| Owner | relation → DB-B | |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-7: Model Updates Log — Planned

**Title:** `Name` (formerly `Revision`)

| Field | Type | Options |
|---|---|---|
| Name | title | Update title |
| Project | relation → DB-A | |
| Date | date | |
| Author | relation → DB-B | |
| Update Type | select | Coordination Fix / Modified / Deleted / New Elements / Family Change / Parameter Update |
| Discipline | select | Standard list |
| Affected Elements | rich_text | |
| Summary | rich_text | |
| Tags / Created / Last Edited / Created By | standard | |

---

## DB-8: Commercial & Invoicing — Planned

**Title:** `Name` (formerly `Invoice No`)

| Field | Type | Options |
|---|---|---|
| Name | title | Invoice / claim title |
| Invoice No | rich_text | |
| Project | relation → DB-A | |
| Type | select | PA Claim / Invoice / Credit Note / Variation Invoice |
| Status | select | Draft / Submitted / Under Review / Approved / Rejected / Paid |
| Issue Date | date | |
| Due Date | date | |
| Paid Date | date | |
| Net Payable | number (AED) | |
| Retention | number (AED) | |
| Currency | select | AED / USD / INR / SAR |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-9: Manmonth Consumption — Planned

**Title:** `Name` (formerly `Entry Description`)

| Field | Type | Options |
|---|---|---|
| Name | title | Entry description |
| Entry ID | unique_id MM | |
| Project | relation → DB-A | |
| Month | date | |
| Package / Discipline | select | Standard list |
| Budgeted Manmonths | number | |
| Consumed This Month | number | |
| Cumulative Consumed | number | |
| Burn Rate % | formula | `Cumulative / Budgeted` |
| Planned Progress % | number (percent) | |
| Actual Progress % | number (percent) | |
| Efficiency Index | formula | `Actual % / Burn Rate %` |
| Health Status | select | On Track / At Risk / Over Budget |
| Resources Deployed | number | |
| Tags / Remarks / Created / Last Edited / Created By | standard | |

---

## DB-10: Variation Register — Planned

**Title:** `Name` (formerly `Variation ID`)

| Field | Type | Options |
|---|---|---|
| Name | title | Variation title |
| Variation ID | unique_id VO | |
| Project | relation → DB-A | |
| Status | select | Draft / Submitted / Pending Approval / Approved / Rejected / Withdrawn |
| Reason | select | Client Change / Scope Add / Scope Remove / Design Dev / Errors / Site Conditions |
| Cost Impact | number (AED) | |
| Time Impact (days) | number | |
| Resource Impact (manmonths) | number | |
| Raised Date / Approved Date | date | |
| Approved By | rich_text | |
| Linked Drawings | relation → DB-1 | |
| Tags / Description / Notes / Created / Last Edited / Created By | standard | |

---

## DB-11: KPI Dashboard — Planned

**Title:** `Name` (formerly `Staff Name` rendered weirdly)

| Field | Type | Options |
|---|---|---|
| Name | title | Free-form (typically Project + Month) |
| Project | relation → DB-A | |
| Month | date | |
| Staff | relation → DB-B | |
| KPI Type | select | Productivity / Quality / Timeliness / Attendance / Teamwork / Sheet KPI / Model KPI / Param KPI |
| KPI Value | number | |
| Target | number | |
| Achievement % | formula | `(Value / Target) × 100` |
| Day Status | select | Present / Half Day / Leave / Holiday / WFH |
| Rating | select | Outstanding / Exceeds / Meets / Needs Improvement |
| Tags / Notes / Created / Last Edited / Created By | standard | |

---

## DB-12: Timesheet Register — Planned

**Title:** `Name` (formerly `Entry ID`)

| Field | Type | Options |
|---|---|---|
| Name | title | Entry description |
| Entry ID | unique_id TS | |
| Project | relation → DB-A | |
| Employee | relation → DB-B | |
| Date | date | |
| Hours | number | |
| Task | rich_text | |
| Discipline | select | Standard list |
| Billable | checkbox | |
| Status | select | Draft / Submitted / Approved / Rejected / Invoiced |
| Rate Type | select | Type 1 — Monthly / Type 2 — Man-hours |
| Rate AED/hr | number | |
| Amount | formula | `Hours × Rate` |
| Week Ending | date | |
| Tags / Notes / Submitted By / Approved By / Created / Last Edited | standard | |

---

## After all 14 DBs are built

1. Each DB ID gets pasted into Vercel env (`scripts/set-vercel-env-v2.ps1`)
2. App's `_notionDbs.js` updated for new property names (mostly just `Name` everywhere)
3. Folder importer updated to use new property mappings
4. `vercel --prod` deploy
5. Re-run folder importer to populate v2 DBs from MASTER REGISTERS

Old v1 hub (DB-A through DB-12 in current SSOT Hub) can be deleted once v2 is verified working.
