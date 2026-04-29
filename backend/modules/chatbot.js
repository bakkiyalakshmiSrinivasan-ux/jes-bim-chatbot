/**
 * ============================================
 * Chatbot Module
 * ============================================
 * Processes natural language queries and returns structured responses.
 *
 * ARCHITECTURE:
 * - Currently uses keyword-based intent detection
 * - Structured so you can plug in Claude/OpenAI API later
 *   (see the `processWithAI` function at the bottom)
 */

const { readData } = require('./dataHandler');
const { applyFilters } = require('./filter');

// ---- Intent Definitions ----
// Each intent has keywords and a handler function
const INTENTS = [
  {
    name: 'bench_employees',
    keywords: ['bench', 'available', 'unassigned', 'free', 'idle', 'not assigned'],
    handler: handleBenchQuery,
  },
  {
    name: 'project_list',
    keywords: ['projects', 'project list', 'all projects', 'show projects'],
    handler: handleProjectQuery,
  },
  {
    name: 'employee_list',
    keywords: ['employees', 'team', 'staff', 'resources', 'people', 'engineers'],
    handler: handleEmployeeQuery,
  },
  {
    name: 'project_status',
    keywords: ['active projects', 'on hold', 'completed projects', 'project status'],
    handler: handleProjectStatusQuery,
  },
  {
    name: 'utilization',
    keywords: ['utilization', 'usage', 'workload', 'capacity'],
    handler: handleUtilizationQuery,
  },
  {
    name: 'department',
    keywords: ['mep', 'structural', 'architectural', 'bim', 'quality', 'department'],
    handler: handleDepartmentQuery,
  },
  {
    name: 'kpi_summary',
    keywords: ['kpi', 'dashboard', 'summary', 'overview', 'metrics', 'stats'],
    handler: handleKPISummary,
  },
  {
    name: 'budget',
    keywords: ['budget', 'cost', 'spent', 'spending', 'expense', 'financial'],
    handler: handleBudgetQuery,
  },
  {
    name: 'greeting',
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
    handler: handleGreeting,
  },
  {
    name: 'help',
    keywords: ['help', 'what can you do', 'commands', 'how to use'],
    handler: handleHelp,
  },
];

/**
 * Main entry point: process a user message.
 * Returns a structured response object.
 */
async function processMessage(message) {
  const input = message.toLowerCase().trim();

  // --- Check if AI is configured ---
  if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== '') {
    return await processWithAI(message);
  }

  // --- Keyword-based intent matching ---
  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => input.includes(kw))) {
      return intent.handler(input);
    }
  }

  // No intent matched
  return {
    text: "I'm not sure I understand that. Try asking about projects, employees, bench resources, utilization, budgets, or KPIs. Type 'help' to see what I can do!",
    data: null,
    type: 'text',
  };
}

// ============================================
// Intent Handlers
// ============================================

function handleBenchQuery(input) {
  const employees = readData('employees');
  const bench = employees.filter((e) => e.status === 'Bench');

  return {
    text: `There are **${bench.length} employees** currently on the bench:`,
    data: bench.map((e) => ({
      name: e.name,
      role: e.role,
      department: e.department,
      utilization: `${e.utilization}%`,
    })),
    type: 'table',
    columns: ['name', 'role', 'department', 'utilization'],
  };
}

function handleProjectQuery(input) {
  const projects = readData('projects');

  // Check for specific status filter in the query
  let filtered = projects;
  if (input.includes('active')) {
    filtered = projects.filter((p) => p.status === 'Active');
  } else if (input.includes('on hold') || input.includes('hold')) {
    filtered = projects.filter((p) => p.status === 'On Hold');
  } else if (input.includes('completed') || input.includes('finished')) {
    filtered = projects.filter((p) => p.status === 'Completed');
  }

  return {
    text: `Found **${filtered.length} projects**:`,
    data: filtered.map((p) => ({
      name: p.name,
      client: p.client,
      status: p.status,
      progress: `${p.progress}%`,
      manager: p.manager,
    })),
    type: 'table',
    columns: ['name', 'client', 'status', 'progress', 'manager'],
  };
}

function handleEmployeeQuery(input) {
  const employees = readData('employees');

  // Check for department-specific queries
  const depts = ['mep', 'structural', 'architectural', 'bim', 'quality'];
  let filtered = employees;
  for (const dept of depts) {
    if (input.includes(dept)) {
      filtered = employees.filter(
        (e) => e.department.toLowerCase() === dept
      );
      break;
    }
  }

  return {
    text: `Found **${filtered.length} employees**:`,
    data: filtered.map((e) => ({
      name: e.name,
      role: e.role,
      department: e.department,
      status: e.status,
      project: e.project || 'None',
      utilization: `${e.utilization}%`,
    })),
    type: 'table',
    columns: ['name', 'role', 'department', 'status', 'project', 'utilization'],
  };
}

function handleProjectStatusQuery(input) {
  const projects = readData('projects');
  const active = projects.filter((p) => p.status === 'Active').length;
  const onHold = projects.filter((p) => p.status === 'On Hold').length;
  const completed = projects.filter((p) => p.status === 'Completed').length;

  return {
    text: `**Project Status Summary:**\n- Active: ${active}\n- On Hold: ${onHold}\n- Completed: ${completed}\n- Total: ${projects.length}`,
    data: { active, onHold, completed, total: projects.length },
    type: 'summary',
  };
}

function handleUtilizationQuery(input) {
  const employees = readData('employees');
  const avgUtil =
    employees.reduce((sum, e) => sum + (e.utilization || 0), 0) /
    employees.length;
  const highUtil = employees.filter((e) => e.utilization >= 80);
  const lowUtil = employees.filter((e) => e.utilization < 30);

  return {
    text: `**Utilization Overview:**\n- Average Utilization: ${avgUtil.toFixed(1)}%\n- High Utilization (≥80%): ${highUtil.length} employees\n- Low Utilization (<30%): ${lowUtil.length} employees`,
    data: employees
      .sort((a, b) => b.utilization - a.utilization)
      .map((e) => ({
        name: e.name,
        role: e.role,
        utilization: `${e.utilization}%`,
        status: e.status,
      })),
    type: 'table',
    columns: ['name', 'role', 'utilization', 'status'],
  };
}

function handleDepartmentQuery(input) {
  const employees = readData('employees');
  const depts = {};
  employees.forEach((e) => {
    if (!depts[e.department]) depts[e.department] = { count: 0, bench: 0 };
    depts[e.department].count++;
    if (e.status === 'Bench') depts[e.department].bench++;
  });

  const summary = Object.entries(depts).map(([dept, info]) => ({
    department: dept,
    total: info.count,
    bench: info.bench,
    assigned: info.count - info.bench,
  }));

  return {
    text: `**Department Breakdown:**`,
    data: summary,
    type: 'table',
    columns: ['department', 'total', 'assigned', 'bench'],
  };
}

function handleKPISummary(input) {
  const employees = readData('employees');
  const projects = readData('projects');

  const totalEmployees = employees.length;
  const benchCount = employees.filter((e) => e.status === 'Bench').length;
  const avgUtil =
    employees.reduce((sum, e) => sum + e.utilization, 0) / totalEmployees;
  const activeProjects = projects.filter((p) => p.status === 'Active').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);

  return {
    text: `**KPI Summary:**\n- Total Employees: ${totalEmployees}\n- Bench Count: ${benchCount}\n- Avg Utilization: ${avgUtil.toFixed(1)}%\n- Active Projects: ${activeProjects}\n- Total Budget: $${(totalBudget / 1000000).toFixed(1)}M\n- Total Spent: $${(totalSpent / 1000000).toFixed(1)}M\n- Budget Used: ${((totalSpent / totalBudget) * 100).toFixed(1)}%`,
    data: null,
    type: 'summary',
  };
}

function handleBudgetQuery(input) {
  const projects = readData('projects');

  return {
    text: `**Budget Overview:**`,
    data: projects.map((p) => ({
      project: p.name,
      budget: `$${(p.budget / 1000).toFixed(0)}K`,
      spent: `$${(p.spent / 1000).toFixed(0)}K`,
      remaining: `$${((p.budget - p.spent) / 1000).toFixed(0)}K`,
      percentUsed: `${((p.spent / p.budget) * 100).toFixed(1)}%`,
    })),
    type: 'table',
    columns: ['project', 'budget', 'spent', 'remaining', 'percentUsed'],
  };
}

function handleGreeting() {
  return {
    text: "Hello! 👋 I'm your Smart Dashboard Assistant. I can help you with project info, employee data, bench reports, utilization metrics, budgets, and KPIs. What would you like to know?",
    data: null,
    type: 'text',
  };
}

function handleHelp() {
  return {
    text: `**Here's what I can help with:**\n\n- "Show bench employees" → List available/unassigned staff\n- "Show all projects" or "active projects" → Project listings\n- "Show employees" or "MEP engineers" → Employee data\n- "Project status" → Status summary\n- "Utilization" → Workload overview\n- "Department breakdown" → Team composition\n- "KPI summary" → Key metrics overview\n- "Budget overview" → Financial summary\n\nYou can also combine keywords like "show MEP engineers" or "active projects in Dubai"!`,
    data: null,
    type: 'text',
  };
}

// ============================================
// AI Integration (plug-in point)
// ============================================

/**
 * Process a message using an external AI API.
 * Uncomment and configure to switch from keyword search to live AI.
 *
 * To enable:
 * 1. Set AI_PROVIDER in .env (e.g., "claude" or "openai")
 * 2. Set the corresponding API key
 * 3. Install the SDK: npm install @anthropic-ai/sdk  OR  npm install openai
 */
async function processWithAI(message) {
  const provider = process.env.AI_PROVIDER;

  // Load all data to give AI context
  const projects = readData('projects');
  const employees = readData('employees');

  const systemPrompt = `You are a helpful assistant for a project management dashboard.
You have access to the following data:

PROJECTS: ${JSON.stringify(projects)}

EMPLOYEES: ${JSON.stringify(employees)}

Answer user questions based on this data. Be concise and provide structured answers.
If showing tabular data, return JSON with format: { "text": "description", "data": [...], "type": "table", "columns": [...] }
Otherwise return: { "text": "your answer", "data": null, "type": "text" }
Always return valid JSON.`;

  try {
    if (provider === 'claude') {
      // ---- Claude API Integration ----
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const aiText = response.content[0].text;
      try {
        return JSON.parse(aiText);
      } catch {
        return { text: aiText, data: null, type: 'text' };
      }
    } else if (provider === 'openai') {
      // ---- OpenAI API Integration ----
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 1024,
      });

      const aiText = response.choices[0].message.content;
      try {
        return JSON.parse(aiText);
      } catch {
        return { text: aiText, data: null, type: 'text' };
      }
    }
  } catch (error) {
    console.error('AI API Error:', error.message);
    // Fall back to keyword search on error
    return {
      text: `⚠️ AI service unavailable. Falling back to keyword search.\n\n${error.message}`,
      data: null,
      type: 'text',
    };
  }
}

module.exports = { processMessage };
