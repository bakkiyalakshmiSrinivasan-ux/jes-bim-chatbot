/**
 * ============================================
 * PDF Report Generator Module
 * ============================================
 * Generates professional PDF reports using PDFKit.
 * Supports: Bench Report, Resource Summary, Project Overview
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { readData } = require('./dataHandler');
const { applyFilters } = require('./filter');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Color palette
const COLORS = {
  primary: '#1e40af',
  secondary: '#64748b',
  accent: '#059669',
  danger: '#dc2626',
  light: '#f1f5f9',
  dark: '#0f172a',
  white: '#ffffff',
};

/**
 * Generate a PDF report based on type and filters.
 * @param {string} reportType - "bench" | "resource" | "project"
 * @param {Object} filters - Optional filter criteria
 * @returns {string} Path to the generated PDF file
 */
async function generateReport(reportType, filters = {}) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${reportType}-report-${timestamp}-${Date.now()}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Add header to every report
  addHeader(doc, reportType);

  switch (reportType) {
    case 'bench':
      generateBenchReport(doc, filters);
      break;
    case 'resource':
      generateResourceReport(doc, filters);
      break;
    case 'project':
      generateProjectReport(doc, filters);
      break;
    default:
      doc.fontSize(14).text('Unknown report type.', 50, 150);
  }

  // Add footer
  addFooter(doc);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filename));
    stream.on('error', reject);
  });
}

// ---- Header ----
function addHeader(doc, reportType) {
  const titles = {
    bench: 'Bench Resource Report',
    resource: 'Resource Utilization Summary',
    project: 'Project Overview Report',
  };

  // Blue header bar
  doc.rect(0, 0, 612, 80).fill(COLORS.primary);
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(COLORS.white)
    .text(titles[reportType] || 'Report', 50, 25);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#93c5fd')
    .text(`Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}`, 50, 52);

  doc.fillColor(COLORS.dark); // reset color
  doc.moveDown(3);
}

// ---- Footer ----
function addFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(COLORS.secondary)
      .text(
        `Smart Dashboard • Page ${i + 1} of ${pages.count} • Confidential`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
  }
}

// ---- Draw a simple table ----
function drawTable(doc, headers, rows, startY) {
  const colWidth = (doc.page.width - 100) / headers.length;
  let y = startY || doc.y + 10;

  // Header row
  doc.rect(50, y, doc.page.width - 100, 22).fill(COLORS.primary);
  headers.forEach((header, i) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(header, 55 + i * colWidth, y + 6, {
        width: colWidth - 10,
        align: 'left',
      });
  });
  y += 22;

  // Data rows
  rows.forEach((row, rowIdx) => {
    // Check for page break
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    // Alternating row colors
    if (rowIdx % 2 === 0) {
      doc.rect(50, y, doc.page.width - 100, 20).fill(COLORS.light);
    }

    row.forEach((cell, i) => {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.dark)
        .text(String(cell || '—'), 55 + i * colWidth, y + 5, {
          width: colWidth - 10,
          align: 'left',
        });
    });
    y += 20;
  });

  doc.y = y + 10;
}

// ============================================
// Report Generators
// ============================================

function generateBenchReport(doc, filters) {
  const employees = readData('employees');
  const bench = applyFilters(
    employees.filter((e) => e.status === 'Bench'),
    filters
  );

  doc.y = 100;
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.dark)
    .text(`Bench Employees: ${bench.length}`, 50);
  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.secondary)
    .text('Employees currently not assigned to any project.');
  doc.moveDown(1);

  const headers = ['Name', 'Role', 'Department', 'Utilization', 'Skills'];
  const rows = bench.map((e) => [
    e.name,
    e.role,
    e.department,
    `${e.utilization}%`,
    (e.skills || []).join(', '),
  ]);

  drawTable(doc, headers, rows);

  // Summary box
  doc.moveDown(1);
  doc.rect(50, doc.y, doc.page.width - 100, 50).fill('#fef3c7');
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.dark)
    .text('Summary', 60, doc.y + 10 - 50);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(
      `${bench.length} employees on bench with average utilization of ${(bench.reduce((s, e) => s + e.utilization, 0) / (bench.length || 1)).toFixed(1)}%`,
      60,
      doc.y + 25 - 50
    );
}

function generateResourceReport(doc, filters) {
  const employees = applyFilters(readData('employees'), filters);

  doc.y = 100;
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.dark)
    .text(`Resource Summary: ${employees.length} Employees`, 50);
  doc.moveDown(1);

  const headers = ['Name', 'Role', 'Department', 'Status', 'Project', 'Utilization'];
  const rows = employees.map((e) => [
    e.name,
    e.role,
    e.department,
    e.status,
    e.project || 'None',
    `${e.utilization}%`,
  ]);

  drawTable(doc, headers, rows);

  // Dept breakdown
  doc.moveDown(1);
  const depts = {};
  employees.forEach((e) => {
    if (!depts[e.department]) depts[e.department] = 0;
    depts[e.department]++;
  });

  doc.font('Helvetica-Bold').fontSize(12).text('Department Breakdown:', 50);
  doc.moveDown(0.5);
  Object.entries(depts).forEach(([dept, count]) => {
    doc.font('Helvetica').fontSize(10).text(`  • ${dept}: ${count} employees`, 60);
  });
}

function generateProjectReport(doc, filters) {
  const projects = applyFilters(readData('projects'), filters);

  doc.y = 100;
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.dark)
    .text(`Project Overview: ${projects.length} Projects`, 50);
  doc.moveDown(1);

  const headers = ['Project', 'Client', 'Status', 'Progress', 'Budget', 'Spent'];
  const rows = projects.map((p) => [
    p.name,
    p.client,
    p.status,
    `${p.progress}%`,
    `$${(p.budget / 1000).toFixed(0)}K`,
    `$${(p.spent / 1000).toFixed(0)}K`,
  ]);

  drawTable(doc, headers, rows);

  // Totals
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);

  doc.moveDown(1);
  doc.rect(50, doc.y, doc.page.width - 100, 60).fill('#dbeafe');
  const boxY = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.dark)
    .text('Financial Summary', 60, boxY + 8);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(`Total Budget: $${(totalBudget / 1000000).toFixed(2)}M`, 60, boxY + 24);
  doc.text(`Total Spent: $${(totalSpent / 1000000).toFixed(2)}M`, 60, boxY + 36);
  doc.text(
    `Remaining: $${((totalBudget - totalSpent) / 1000000).toFixed(2)}M (${((totalSpent / totalBudget) * 100).toFixed(1)}% used)`,
    60,
    boxY + 48
  );
}

module.exports = { generateReport };
