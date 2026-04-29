# JES BIM Operations — Resourcing Report Templates

> **Purpose:** Single-file reference of the 6 standard **manpower / resourcing-model** report templates.
> **Usage:** Copy the relevant section into a new file, replace placeholder values (wrapped in `< >`), and fill the tables. Calculation rules at the bottom.
> **Version:** 1.0 · **Last updated:** 16-Apr-2026 · **Owner:** JES BIM Operations

---

## Table of Contents

1. [Resourcing Monthly Invoice (PA)](#1-resourcing-monthly-invoice-pa)
2. [Resourcing Monthly Report](#2-resourcing-monthly-report)
3. [Resource Utilization Report](#3-resource-utilization-report)
4. [Resourcing KPI Report](#4-resourcing-kpi-report)
5. [Resource Variation Report](#5-resource-variation-report)
6. [Portfolio PA Summary (Resourcing)](#6-portfolio-pa-summary-resourcing)
7. [Calculation Rules & Validation](#calculation-rules--validation)

---

# 1. Resourcing Monthly Invoice (PA)

## Resourcing Monthly Invoice — Payment Application

### Project Information

| Field | Value |
|---|---|
| Project Name | `<project name>` |
| Client | `<client>` |
| Billing Month | `<MMM YYYY>` |
| Invoice No | `<INV-RES-YYYY-NNN>` |
| Date Issued | `<DD-MMM-YYYY>` |

### Resource Billing Summary

| Resource | Role | Hours | Rate (AED/hr) | Amount (AED) |
|---|---|---:|---:|---:|
| `<name>` | `<role>` | `<hrs>` | `<rate>` | `<amount>` |
| **Total** | — | `<hrs>` | — | `<amount>` |

### Financial Summary

| Description | Amount (AED) |
|---|---:|
| Total Hours | `<hrs>` |
| Gross Amount | `<amount>` |
| Deductions | `<amount>` |
| Net Payable | `<amount>` |

### Timesheet Summary

| Employee | Total Hours | Billable | Non-Billable |
|---|---:|---:|---:|
| `<name>` | `<hrs>` | `<hrs>` | `<hrs>` |

### Payment Certification

> We certify that the above resources have worked as per the agreed contract.

| Prepared By | Approved By |
|---|---|
| `<name>` — `<role>` | `<name>` — `<role>` |
| Signature: _______________ | Signature: _______________ |
| Date: `<DD-MMM-YYYY>` | Date: `<DD-MMM-YYYY>` |

---

# 2. Resourcing Monthly Report

## Resourcing Monthly Report

### Overview

| Field | Value |
|---|---|
| Project Name | `<project>` |
| Period | `<MMM YYYY>` |
| Total Resources | `<n>` |
| Total Hours | `<hrs>` |
| Report Prepared By | `<name>` |

### Resource Allocation

| Resource | Role | Assigned Project | Status |
|---|---|---|---|
| `<name>` | `<role>` | `<project>` | Active / Bench / On Leave |

### Work Summary

| Resource | Tasks | Hours | Output |
|---|---|---:|---|
| `<name>` | `<tasks>` | `<hrs>` | `<output>` |

### Utilization Summary

- **Average Utilization %:** `<%>`
- **Overutilized Resources (>110%):** `<names>`
- **Underutilized Resources (<70%):** `<names>`

### Key Highlights

- **Achievements:** `<list>`
- **Issues:** `<list>`
- **Plan for Next Month:** `<list>`

---

# 3. Resource Utilization Report

## Resource Utilization Report

### Summary

| Field | Value |
|---|---:|
| Reporting Period | `<MMM YYYY>` |
| Total Available Hours | `<hrs>` |
| Total Worked Hours | `<hrs>` |
| Utilization % | `<%>` |

### Resource Breakdown

| Resource | Available (h) | Worked (h) | Utilization % |
|---|---:|---:|---:|
| `<name>` | `<hrs>` | `<hrs>` | `<%>` |

### Classification

| Category | Count |
|---|---:|
| Fully Utilized (>90%) | `<n>` |
| Moderate (60–90%) | `<n>` |
| Low (<60%) | `<n>` |

### Insights

- **High Performers:** `<names>`
- **Low Utilization:** `<names>`
- **Recommended Action:** `<action>`

---

# 4. Resourcing KPI Report

## Resourcing KPI Report

### Employee KPI

| Resource | Productivity | Utilization | Quality | Score |
|---|---:|---:|---:|---:|
| `<name>` | `<%>` | `<%>` | `<score>` | `<final>` |

### Metrics

- **Avg Productivity:** `<%>`
- **Avg Utilization:** `<%>`
- **Quality Index:** `<score>`

### Ranking

| Rank | Resource | Score |
|---:|---|---:|
| 1 | `<name>` | `<score>` |
| 2 | `<name>` | `<score>` |
| 3 | `<name>` | `<score>` |

### Insights

- **Top Performers:** `<names>`
- **Improvement Areas:** `<list>`

---

# 5. Resource Variation Report

## Resource Variation Report

### Variation Details

| Field | Value |
|---|---|
| Project | `<project>` |
| Variation ID | `<VAR-RES-YYYY-NNN>` |
| Date Raised | `<DD-MMM-YYYY>` |
| Resource Change | Add / Remove / Swap / Extend |

### Change Summary

| Resource | Previous Hours | Revised Hours | Difference |
|---|---:|---:|---:|
| `<name>` | `<hrs>` | `<hrs>` | `<±hrs>` |

### Cost Impact

| Description | Amount (AED) |
|---|---:|
| Previous Cost | `<amount>` |
| Revised Cost | `<amount>` |
| Difference | `<±amount>` |

### Approval

- **Status:** Pending / Approved / Rejected
- **Approved By:** `<name>`
- **Remarks:** `<remarks>`

---

# 6. Portfolio PA Summary (Resourcing)

## Portfolio Resourcing Billing Summary

### Overview

| Field | Value |
|---|---:|
| Reporting Period | `<MMM YYYY>` |
| Total Projects | `<n>` |
| Total Resources | `<n>` |
| Total Hours | `<hrs>` |
| Total Billing (AED) | `<amount>` |

### Project Breakdown

| Project | Resources | Hours | Billing (AED) |
|---|---:|---:|---:|
| `<project>` | `<n>` | `<hrs>` | `<amount>` |
| **Total** | `<n>` | `<hrs>` | `<amount>` |

### Resource Distribution

| Role | Count | Utilization % |
|---|---:|---:|
| `<role>` | `<n>` | `<%>` |

### Insights

- **High Billing Projects:** `<names>`
- **Low Utilization Projects:** `<names>`
- **Recommended Action:** `<action>`

---

# Calculation Rules & Validation

### Billing

- **Line Amount** = Hours × Rate
- **Gross Amount** = Σ Line Amounts
- **Net Payable** = Gross Amount − Deductions

### Utilization

- **Utilization %** = (Worked Hours ÷ Available Hours) × 100
- **Available Hours** = Working Days × 8 (default) or per contract
- **Billable %** = (Billable Hours ÷ Total Hours) × 100

### Productivity

- **Productivity** = Output ÷ Hours
- **Efficiency %** = (Planned Hours ÷ Actual Hours) × 100

### KPI Scoring (0–100)

- Weighted composite of Productivity, Utilization, Quality, Attendance
- **Rating Bands:** ≥90 Outstanding · 75–89 Exceeds · 60–74 Meets · <60 Needs Improvement

### Validation Flags

- ✔ **Verified** — Totals reconcile, variance within ±2%
- ⚠ **Issue detected** — Variance >2% or missing data
- ✘ **Failed** — Critical mismatch; do not circulate

---

*End of JES BIM Operations — Resourcing Report Templates*
