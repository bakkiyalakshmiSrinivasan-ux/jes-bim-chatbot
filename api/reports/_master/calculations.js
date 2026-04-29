// api/report/calculations.js
// Shared financial / KPI calculation helpers aligned with the
// "Calculation Rules" page of JES_BIM_Master_Template_Pack.pdf v1.0.
//
// All functions tolerate nulls and return numbers (or NaN) — formatters
// in helpers.js handle the display layer.

function num(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) ? n : NaN;
}

// Billing (lump-sum): Completion % × Milestone Weight × Contract Value
// completion and weight are expected as 0–100 percentages.
function lumpSumBilling(completionPct, milestoneWeightPct, contractValue) {
  const c = num(completionPct) / 100;
  const w = num(milestoneWeightPct) / 100;
  const v = num(contractValue);
  return c * w * v;
}

// Billing (resourcing): Hours × Rate
function resourcingBilling(hours, rate) {
  return num(hours) * num(rate);
}

// Cumulative Billing = Previous Billing + Current Billing
function cumulativeBilling(previous, current) {
  return num(previous) + num(current);
}

// Retention = 5% of Current Billing (unless contract overrides)
function retention(currentBilling, pct = 5) {
  return num(currentBilling) * (num(pct) / 100);
}

// Net Payable = Current Billing − Retention
function netPayable(currentBilling, retentionAmount) {
  return num(currentBilling) - num(retentionAmount);
}

// Efficiency % = Planned ÷ Actual × 100
function efficiencyPct(plannedHours, actualHours) {
  const a = num(actualHours);
  if (!a) return NaN;
  return (num(plannedHours) / a) * 100;
}

// Utilization % = Worked ÷ Available × 100
function utilizationPct(workedHours, availableHours) {
  const a = num(availableHours);
  if (!a) return NaN;
  return (num(workedHours) / a) * 100;
}

// Productivity = Output Units ÷ Actual Hours
function productivity(outputUnits, actualHours) {
  const a = num(actualHours);
  if (!a) return NaN;
  return num(outputUnits) / a;
}

// Balance = Contract Value − Cumulative Billing
function balance(contractValue, cumulative) {
  return num(contractValue) - num(cumulative);
}

// Outstanding = Contract Value − Claimed
function outstanding(contractValue, claimed) {
  return num(contractValue) - num(claimed);
}

// Bench % = Bench Count ÷ Total Employees × 100
function benchPct(benchCount, totalEmployees) {
  const t = num(totalEmployees);
  if (!t) return NaN;
  return (num(benchCount) / t) * 100;
}

// Variance = Actual − Target (used in KPI dashboard and progress report rows)
function variance(actual, target) {
  return num(actual) - num(target);
}

// Weighted KPI score: sum(weight_i × score_i) / 100
function weightedKpiScore(rows) {
  let total = 0;
  for (const r of rows) {
    const w = num(r.weight);
    const s = num(r.score);
    if (isFinite(w) && isFinite(s)) total += (w * s) / 100;
  }
  return total;
}

// Validation label from variance threshold
// Default: ±2% verified, >±10% failed, otherwise issue
function validateVariance(variancePct, verifiedAbs = 2, failedAbs = 10) {
  const v = Math.abs(num(variancePct));
  if (!isFinite(v)) return 'issue';
  if (v <= verifiedAbs) return 'verified';
  if (v >= failedAbs) return 'failed';
  return 'issue';
}

// KPI rating band (from Employee KPI template)
function kpiRating(score) {
  const s = num(score);
  if (!isFinite(s)) return '—';
  if (s >= 90) return 'Outstanding';
  if (s >= 75) return 'Exceeds';
  if (s >= 60) return 'Meets';
  return 'Needs Improvement';
}

// Utilization classification band (from Resource Utilization template)
function utilizationBand(utilPct) {
  const u = num(utilPct);
  if (!isFinite(u)) return '—';
  if (u > 90) return 'Fully Utilized';
  if (u >= 60) return 'Moderate';
  return 'Low';
}

module.exports = {
  lumpSumBilling,
  resourcingBilling,
  cumulativeBilling,
  retention,
  netPayable,
  efficiencyPct,
  utilizationPct,
  productivity,
  balance,
  outstanding,
  benchPct,
  variance,
  weightedKpiScore,
  validateVariance,
  kpiRating,
  utilizationBand,
};
