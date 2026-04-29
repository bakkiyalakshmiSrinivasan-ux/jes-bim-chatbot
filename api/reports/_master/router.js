// api/reports/_master/router.js
// Maps a detected chat intent + project/resource data onto one of the
// 16 Master Template Pack templates. Lives inside _master so Vercel
// does not treat it as a standalone serverless function.

function classifyTemplateId(intent, message) {
  const m = (message || '').toLowerCase();
  const isResourcing = intent.billingModel === 'Resourcing' || /\bresourc/.test(m);

  // Specific triggers win first
  if (/\bkick.?off|charter|new project/.test(m))       return 'kickoff_document';
  if (/\bvariation|change order|cost impact/.test(m))  return isResourcing ? 'resource_variation' : 'variation_report';
  if (/\battendance|check.?in|check.?out|present.?absent/.test(m)) return 'attendance_report';
  if (/\bbench|available|unassigned|idle|redeploy/.test(m))       return 'bench_report';
  if (/\butilis|utiliz/.test(m))                                   return isResourcing ? 'resource_utilization' : 'manmonth_report';
  if (/\bman.?month|mm\b|efficiency|planned vs actual/.test(m))    return 'manmonth_report';
  if (/\bemployee|individual|scorecard|performance review/.test(m)) return 'employee_kpi';
  if (/\bkpi|dashboard|productivity|approval rate|delay rate|rework/.test(m)) {
    return isResourcing ? 'resourcing_kpi' : 'kpi_dashboard';
  }
  if (/\binvoice|invoic|payment application|pa-|inv-|billing claim|certif/.test(m) || intent.isBillingQuery) {
    return isResourcing ? 'resourcing_invoice' : 'lump_sum_invoice';
  }
  if (/\bportfolio|overview|roll.?up|all project|multi.?project|total\b/.test(m) || intent.isPortfolioQuery) {
    return isResourcing ? 'portfolio_resourcing_summary' : 'portfolio_summary';
  }
  if (/\bprogress|status|milestone|deliverable/.test(m) || intent.isProgressQuery) {
    return isResourcing ? 'resourcing_monthly_report' : 'progress_report';
  }
  // Fallback: portfolio view — the broadest useful output
  return isResourcing ? 'portfolio_resourcing_summary' : 'portfolio_summary';
}

// Build the data payload each template expects. Uses the project rows
// that chat.js already fetched (same shape as fetchProjects output).
function buildData(templateId, ctx) {
  const { projects = [], project = null, period, user, resources = [] } = ctx;
  const today = formatDate(new Date());
  switch (templateId) {
    case 'portfolio_summary':
      return {
        overview: {
          period,
          totalProjects: projects.length,
          totalContractValue: sum(projects, 'contractValue'),
          totalClaimed: sum(projects, 'claimed'),
          outstanding: sum(projects, 'contractValue') - sum(projects, 'claimed'),
        },
        projects: projects.map(p => ({
          name: p.name,
          contract: p.contractValue,
          claimed: p.claimed,
          balance: (Number(p.contractValue) || 0) - (Number(p.claimed) || 0),
          pctComplete: p.progress,
        })),
        statusDistribution: statusDist(projects),
      };

    case 'portfolio_resourcing_summary':
      return {
        overview: {
          period,
          totalProjects: projects.length,
          totalResources: projects.reduce((s, p) => s + (p.teamSize || 0), 0),
        },
        projects: projects.map(p => ({
          name: p.name,
          resources: p.teamSize,
          hours: Math.round(((p.manmonthsUsed || 0) * 160) * 10) / 10,
          billingAED: p.contractValue,
        })),
      };

    case 'progress_report': {
      const pick = project || projects[0] || {};
      return {
        overview: {
          projectName: pick.name, period,
          overallProgressPct: pick.progress,
          status: pick.status, preparedBy: user, date: today,
        },
        milestones: [], schedule: [], deliverables: [], issues: [], actionPlan: {},
      };
    }

    case 'resourcing_monthly_report': {
      const pick = project || projects[0] || {};
      return {
        overview: {
          project: pick.name, period,
          totalResources: pick.teamSize,
          totalHours: Math.round(((pick.manmonthsUsed || 0) * 160) * 10) / 10,
          preparedBy: user,
        },
        allocation: [], workSummary: [], utilization: {}, highlights: {},
      };
    }

    case 'lump_sum_invoice': {
      const pick = project || projects[0] || {};
      return {
        project: {
          name: pick.name, client: pick.client, contractor: 'JES BIM',
          invoiceNo: 'INV-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 900 + 100),
          month: period, dateIssued: today,
        },
        financial: { contractValue: pick.contractValue },
        milestones: [], cumulativeBilling: [], status: 'verified',
        preparedBy: { nameRole: user, date: today },
        approvedBy: {},
      };
    }

    case 'resourcing_invoice': {
      const pick = project || projects[0] || {};
      return {
        project: { name: pick.name, client: pick.client, billingMonth: period,
          invoiceNo: 'INV-RES-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 900 + 100),
          dateIssued: today },
        resources: [], financial: {}, timesheet: [],
        preparedBy: { nameRole: user, date: today }, approvedBy: {},
      };
    }

    case 'manmonth_report': {
      const pick = project || null;
      return {
        summary: {
          scope: pick ? pick.name : 'All projects', period,
          plannedHours: pick ? (pick.manmonthsBudgeted || 0) * 160 : null,
          actualHours: pick ? (pick.manmonthsUsed || 0) * 160 : null,
        },
        resources: [], discipline: [], productivity: [], insights: {},
      };
    }

    case 'employee_kpi':
      return {
        employee: { period, manager: user },
        metrics: [
          { metric: 'Productivity', weightPct: 30 },
          { metric: 'Quality', weightPct: 25 },
          { metric: 'Timeliness', weightPct: 20 },
          { metric: 'Attendance', weightPct: 15 },
          { metric: 'Teamwork / Collaboration', weightPct: 10 },
        ],
        final: {},
      };

    case 'variation_report':
      return { variation: { project: project && project.name, dateRaised: today },
        impact: {}, supportingDocuments: [], approval: {} };

    case 'resource_variation':
      return { variation: { project: project && project.name, dateRaised: today,
        resourceChange: 'Add / Remove / Swap / Extend' },
        changes: [], cost: {}, approval: {} };

    case 'kickoff_document':
      return { projectInfo: { name: project && project.name, client: project && project.client,
        contractValue: project && project.contractValue },
        scopeOfWork: project && project.scopeDescription,
        deliverables: [], team: [], milestones: [], risks: [] };

    case 'kpi_dashboard':
      return { metrics: [], trends: [], insights: {} };

    case 'resourcing_kpi':
      return { employees: [], metrics: {}, ranking: [], insights: {} };

    case 'resource_utilization':
      return { summary: { period }, breakdown: [], insights: {} };

    case 'bench_report':
      return {
        summary: { reportingDate: today, totalEmployees: resources.length,
          benchCount: resources.filter(r => r.is_bench).length },
        resources: resources.filter(r => r.is_bench).map(r => ({
          name: r.name, role: r.designation, department: r.discipline,
          lastProject: r.current_project, recommendation: 'Redeploy',
        })),
        departmentSplit: [], actionPlan: {},
      };

    case 'attendance_report':
      return { header: { date: today, preparedBy: user, location: 'Office', shift: 'General' },
        attendance: [], summary: {} };

    default:
      return {};
  }
}

function sum(arr, field) {
  return arr.reduce((s, x) => s + (Number(x[field]) || 0), 0);
}
function statusDist(projects) {
  const buckets = {};
  for (const p of projects) {
    const k = p.status || 'Active';
    buckets[k] = buckets[k] || { status: k, count: 0, value: 0 };
    buckets[k].count += 1;
    buckets[k].value += Number(p.contractValue) || 0;
  }
  return Object.values(buckets);
}
function formatDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '-' +
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + '-' +
    d.getFullYear();
}

module.exports = { classifyTemplateId, buildData };
