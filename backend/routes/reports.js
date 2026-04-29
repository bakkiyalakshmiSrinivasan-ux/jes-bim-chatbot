/**
 * ============================================
 * Report Routes
 * ============================================
 * POST /api/reports/generate - Generate a PDF report
 * GET  /api/reports/list     - List generated reports
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { generateReport } = require('../modules/pdfGenerator');
const { authenticateToken } = require('../middleware/auth');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

router.use(authenticateToken);

/**
 * POST /api/reports/generate
 * Body: { type: "bench"|"resource"|"project", filters: { ... } }
 * Returns: { filename, downloadUrl }
 */
router.post('/generate', async (req, res) => {
  try {
    const { type, filters } = req.body;

    if (!type || !['bench', 'resource', 'project'].includes(type)) {
      return res.status(400).json({
        error: 'Report type must be "bench", "resource", or "project".',
      });
    }

    const filename = await generateReport(type, filters || {});
    res.json({
      message: 'Report generated successfully.',
      filename,
      downloadUrl: `/reports/${filename}`,
    });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

/**
 * GET /api/reports/list
 * Returns list of previously generated reports.
 */
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return res.json({ reports: [] });
    }

    const files = fs.readdirSync(REPORTS_DIR)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return {
          filename: f,
          downloadUrl: `/reports/${f}`,
          size: `${(stat.size / 1024).toFixed(1)} KB`,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ reports: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list reports.' });
  }
});

module.exports = router;
