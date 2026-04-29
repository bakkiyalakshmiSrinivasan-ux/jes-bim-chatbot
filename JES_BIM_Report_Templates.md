# JES BIM Operations — Master Report Templates

> **Purpose:** A single-file reference of all 10 standard report templates used across JES BIM Operations.
> **Usage:** Copy the relevant section into a new file, replace placeholder values (wrapped in `< >`), and fill the tables. Calculation rules are defined at the bottom.
> **Version:** 1.0 · **Last updated:** 16-Apr-2026 · **Owner:** JES BIM Operations

---

## Table of Contents

1. [Lump Sum Invoice (PA)](#1-lump-sum-invoice-pa)
2. [Progress Report](#2-progress-report)
3. [Manmonth Report](#3-manmonth-report)
4. [Employee KPI Report](#4-employee-kpi-report)
5. [Variation Report](#5-variation-report)
6. [Kickoff Document](#6-kickoff-document)
7. [Portfolio Summary](#7-portfolio-summary)
8. [KPI Dashboard](#8-kpi-dashboard)
9. [Bench Report](#9-bench-report)
10. [Attendance Report](#10-attendance-report)
11. [Calculation Rules & Validation](#calculation-rules--validation)

---

# 1. Lump Sum Invoice (PA)

## Lump Sum Monthly Invoice — Payment Application

### Project Information

| Field | Value |
|---|---|
| Project Name | `<project name>` |
| Client | `<client>` |
| Contractor | JES BIM |
| Invoice No | `<INV-YYYY-NNN>` |
| Month | `<MMM YYYY>` |
| Date Issued | `<DD-MMM-YYYY>` |

### Financial Summary

| Description | Amount (AED) |
|---|---:|
| Contract Value | `<amount>` |
| Previous Billing | `<amount>` |
| Current Billing | `<amount>` |
| Cumulative Billing | `<amount>` |
| Retention (5%) | `<amount>` |
| Net Payable | `<amount>` |
| Balance | `<amount>` |

### Milestone Breakdown

| Milestone | Weight % | Status | Completion % | Amount (AED) |
|---|---:|---|---:|---:|
| `<M1>` | `<%>` | `<Not Started / In Progress / Complete>` | `<%>` | `<amount>` |
| `<M2>` | `<%>` | `<status>` | `<%>` | `<amount>` |
| **Total** | **100%** | — | `<%>` | `<amount>` |

### Cumulative Billing

| Period | Claim (AED) | Cumulative (AED) | % of Contract |
|---|---:|---:|---:|
| `<MMM YYYY>` | `<amount>` | `<amount>` | `<%>` |
| `<MMM YYYY>` | `<amount>` | `<amount>` | `<%>` |

### Balance Verification

- **Contract Value:** `<amount>`
- **Total Claimed:** `<amount>`
- **Balance:** `<amount>`
- **Status:** ✔ Verified / ⚠ Issue detected

### Payment Certificate

> We certify that the above work has been completed as per the contract terms.

| Prepared By | Approved By |
|---|---|
| `<name>` — `<role>` | `<name>` — `<role>` |
| Signature: _______________ | Signature: _______________ |
| Date: `<DD-MMM-YYYY>` | Date: `<DD-MMM-YYYY>` |

---

# 2. Progress Report

## Monthly Progress Report

### Project Overview

| Field | Value |
|---|---|
| Project Name | `<project>` |
| Period | `<MMM YYYY>` |
| Overall Progress | `<%>` |
| Status | 🟢 On Track / 🟡 At Risk / 🔴 Delayed |
| Report Prepared By | `<name>` |
| Date | `<DD-MMM-YYYY>` |

### Progress Tracking

| Milestone | Planned % | Actual % | Variance | Status |
|---|---:|---:|---:|---|
| `<milestone>` | `<%>` | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |
| `<milestone>` | `<%>` | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |

### Schedule Status

| Activity | Planned Date | Actual Date | Status |
|---|---|---|---|
| `<activity>` | `<DD-MMM-YYYY>` | `<DD-MMM-YYYY>` | On Time / Delayed / Early |

### Deliverables

| Package | Planned | Submitted | Approved | Status |
|---|---:|---:|---:|---|
| `<package>` | `<n>` | `<n>` | `<n>` | ✔ / In Review |

### Issues & Risks

| Issue | Impact | Status | Owner |
|---|---|---|---|
| `<issue>` | High / Med / Low | Open / Mitigated / Closed | `<owner>` |

### Action Plan

- **Next Steps:** `<list>`
- **Delays / Blockers:** `<list>`
- **Decisions Required:** `<list>`

---

# 3. Manmonth Report

## Manmonth Efficiency Report

### Summary

| Field | Value |
|---|---:|
| Project / Dept | `<scope>` |
| Period | `<MMM YYYY>` |
| Planned Hours | `<hrs>` |
| Actual Hours | `<hrs>` |
| Efficiency % | `<%>` |
| Utilization % | `<%>` |

### Resource Utilization

| Employee | Role | Planned (hrs) | Actual (hrs) | Utilization % | Efficiency % |
|---|---|---:|---:|---:|---:|
| `<name>` | `<role>` | `<hrs>` | `<hrs>` | `<%>` | `<%>` |

### Discipline Breakdown

| Discipline | Planned (hrs) | Actual (hrs) | Variance (hrs) |
|---|---:|---:|---:|
| Architectural | `<hrs>` | `<hrs>` | `<±hrs>` |
| Structural | `<hrs>` | `<hrs>` | `<±hrs>` |
| MEP | `<hrs>` | `<hrs>` | `<±hrs>` |
| BIM Coordination | `<hrs>` | `<hrs>` | `<±hrs>` |

### Productivity

| Deliverable | Hours | Output (units) | Rate (units/hr) |
|---|---:|---:|---:|
| `<deliverable>` | `<hrs>` | `<n>` | `<rate>` |

### Insights

- **Overutilized (>110%):** `<names>`
- **Underutilized (<70%):** `<names>`
- **Recommended Action:** `<action>`

---

# 4. Employee KPI Report

## Employee KPI Report

### Employee Details

| Field | Value |
|---|---|
| Name | `<name>` |
| Employee ID | `<ID>` |
| Role | `<role>` |
| Department | `<dept>` |
| Project(s) | `<projects>` |
| Period | `<MMM YYYY>` |
| Reporting Manager | `<manager>` |

### KPI Metrics

| Metric | Weight % | Score (0–100) | Weighted Score |
|---|---:|---:|---:|
| Productivity | 30 | `<score>` | `<value>` |
| Quality | 25 | `<score>` | `<value>` |
| Timeliness | 20 | `<score>` | `<value>` |
| Attendance | 15 | `<score>` | `<value>` |
| Teamwork / Collaboration | 10 | `<score>` | `<value>` |
| **Total** | **100** | — | `<final>` |

### Final Score

- **KPI Score:** `<score>/100`
- **KPI Rating:** Outstanding (≥90) / Exceeds (75–89) / Meets (60–74) / Needs Improvement (<60)
- **Recommendation:** Retain / Redeploy / Coaching / PIP

### Comments

> `<manager comments>`

---

# 5. Variation Report

## Variation Claim Report

### Variation Details

| Field | Value |
|---|---|
| Project | `<project>` |
| Variation ID | `<VAR-YYYY-NNN>` |
| Date Raised | `<DD-MMM-YYYY>` |
| Description | `<description>` |
| Reason / Trigger | `<client change / scope add / design dev>` |
| Raised By | `<name>` |

### Impact

| Impact Type | Value |
|---|---:|
| Cost Impact (AED) | `<±amount>` |
| Time Impact (days) | `<±days>` |
| Resource Impact (manmonths) | `<±mm>` |

### Supporting Documents

| Document | Reference |
|---|---|
| `<drawing / RFI / email>` | `<ref no>` |

### Approval Status

- **Status:** Pending / Approved / Rejected / On Hold
- **Approved By:** `<name>`
- **Approval Date:** `<DD-MMM-YYYY>`
- **Remarks:** `<remarks>`

---

# 6. Kickoff Document

## Project Kickoff Document

### Project Info

| Field | Value |
|---|---|
| Project Name | `<project>` |
| Project Code | `<code>` |
| Client | `<client>` |
| Location | `<location>` |
| Contract Value | `<amount>` |
| Start Date | `<DD-MMM-YYYY>` |
| End Date | `<DD-MMM-YYYY>` |
| Duration | `<months>` |

### Scope of Work

> `<scope description — LOD levels, disciplines, deliverable types>`

### Deliverables

| Deliverable | Discipline | Deadline |
|---|---|---|
| `<deliverable>` | Arch / Struct / MEP | `<DD-MMM-YYYY>` |

### Team Structure

| Name | Role | Allocation % |
|---|---|---:|
| `<name>` | Project Manager | `<%>` |
| `<name>` | BIM Lead | `<%>` |
| `<name>` | Modeler | `<%>` |

### Timeline / Key Milestones

| Milestone | Date | Owner |
|---|---|---|
| Kickoff | `<DD-MMM-YYYY>` | PM |
| LOD 200 Submission | `<DD-MMM-YYYY>` | BIM Lead |
| LOD 350 Submission | `<DD-MMM-YYYY>` | BIM Lead |
| Final Handover | `<DD-MMM-YYYY>` | PM |

### Risks & Assumptions

| Item | Type | Mitigation |
|---|---|---|
| `<item>` | Risk / Assumption | `<mitigation>` |

---

# 7. Portfolio Summary

## Portfolio Billing Summary

### Overview

| Field | Value |
|---|---:|
| Reporting Period | `<MMM YYYY>` |
| Total Projects | `<n>` |
| Total Contract Value (AED) | `<amount>` |
| Total Claimed (AED) | `<amount>` |
| Outstanding (AED) | `<amount>` |
| Collection Efficiency % | `<%>` |

### Project Breakdown

| Project | Contract (AED) | Claimed (AED) | Balance (AED) | % Complete |
|---|---:|---:|---:|---:|
| `<project>` | `<amount>` | `<amount>` | `<amount>` | `<%>` |
| **Total** | `<amount>` | `<amount>` | `<amount>` | `<%>` |

### Status Distribution

| Status | Count | Value (AED) |
|---|---:|---:|
| Active | `<n>` | `<amount>` |
| On Hold | `<n>` | `<amount>` |
| Completed | `<n>` | `<amount>` |

---

# 8. KPI Dashboard

## KPI Dashboard Report

### Metrics

| KPI | Target | Actual | Variance | Status |
|---|---:|---:|---:|---|
| Productivity % | 90 | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |
| Approval Rate % | 95 | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |
| Delay Rate % | ≤5 | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |
| Utilization % | 85 | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |
| Rework % | ≤10 | `<%>` | `<±%>` | ✔ / ⚠ / ✘ |

### Trends

| Month | Productivity | Approval | Delay | Utilization |
|---|---:|---:|---:|---:|
| `<MMM>` | `<%>` | `<%>` | `<%>` | `<%>` |

### Insights

- **Key Observations:** `<observation>`
- **Wins:** `<win>`
- **Concerns:** `<concern>`
- **Recommended Actions:** `<action>`

---

# 9. Bench Report

## Bench Resource Report

### Summary

| Field | Value |
|---|---:|
| Reporting Date | `<DD-MMM-YYYY>` |
| Total Employees | `<n>` |
| Bench Count | `<n>` |
| Bench % | `<%>` |
| Avg Idle Days | `<days>` |
| Est. Monthly Bench Cost (AED) | `<amount>` |

### Resource List

| Employee | Role | Department | Skills | Last Project | Idle Days | Recommendation |
|---|---|---|---|---|---:|---|
| `<name>` | `<role>` | Arch / MEP | `<skills>` | `<project>` | `<n>` | Redeploy / Train / Release |

### Department Split

| Department | Bench Count | Bench % |
|---|---:|---:|
| Architectural | `<n>` | `<%>` |
| MEP | `<n>` | `<%>` |
| Structural | `<n>` | `<%>` |

### Action Plan

- **Redeploy:** `<names>`
- **Upskill / Training:** `<names>`
- **Release / Exit:** `<names>`

---

# 10. Attendance Report

## Daily Attendance Report

### Header

| Field | Value |
|---|---|
| Date | `<DD-MMM-YYYY>` |
| Location | `<office / site>` |
| Shift | General / Night |
| Prepared By | `<name>` |

### Attendance

| Employee | Role | Check-in | Check-out | Hours | Status |
|---|---|---|---|---:|---|
| `<name>` | `<role>` | `<HH:MM>` | `<HH:MM>` | `<hrs>` | Present / Absent / Leave / WFH |

### Summary

| Metric | Count |
|---|---:|
| Present | `<n>` |
| Absent | `<n>` |
| Leave (Sick / Annual) | `<n>` |
| WFH | `<n>` |
| Overtime Hours | `<hrs>` |
| Late Arrivals | `<n>` |

### Notes

> `<any leave approvals, incidents, or notes>`

---

# Calculation Rules & Validation

### Billing

- **Current Billing** = Completion % of milestone × Milestone Weight × Contract Value
- **Cumulative Billing** = Previous Billing + Current Billing
- **Retention** = 5% of Current Billing (unless contract specifies otherwise)
- **Net Payable** = Current Billing − Retention
- **Balance** = Contract Value − Cumulative Billing

### Productivity

- **Efficiency %** = (Planned Hours ÷ Actual Hours) × 100
- **Utilization %** = (Actual Hours ÷ Available Hours) × 100
- **Productivity Rate** = Output Units ÷ Actual Hours

### KPI Scoring

- **Weighted Score** = Score × (Weight ÷ 100)
- **Final KPI** = Σ Weighted Scores
- **Rating Bands:** ≥90 Outstanding · 75–89 Exceeds · 60–74 Meets · <60 Needs Improvement

### Portfolio

- **Outstanding** = Contract Value − Claimed
- **Collection Efficiency** = (Claimed ÷ Billed) × 100

### Bench

- **Bench %** = (Bench Count ÷ Total Employees) × 100
- **Bench Cost** = Σ (Monthly Salary × Idle Fraction)

### Validation Flags

- ✔ **Verified** — Totals reconcile, variance within ±2%
- ⚠ **Issue detected** — Variance >2% or missing data; requires review
- ✘ **Failed** — Critical mismatch; do not circulate

### Status Icons

- 🟢 On Track · 🟡 At Risk · 🔴 Delayed / Critical
- ✔ Approved · ⏳ Pending · ✘ Rejected

---

*End of JES BIM Operations — Master Report Templates*
