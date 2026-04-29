// api/reports/master.js
// JES BIM Master Template Pack v1.0 — pdfmake renderer.
//
// POST /api/reports/master
//   Body: { templateId: string, data: object, filename?: string }
//   Auth: Bearer <JWT>
//   Returns: application/pdf attachment
//
// GET  /api/reports/master?list=1
//   Returns registry of the 16 templates
//
// This endpoint is additive — existing /api/reports/pdf and /api/reports/excel
// are untouched. Use this one when you want a PDF that matches the
// Master Template Pack layout exactly (invoices, progress reports, KPI
// dashboards, etc. with real structured tables).
//
// Author: integrated via Cowork, Apr 2026.

const path = require('path');
const jwt = require('jsonwebtoken');
const PdfPrinter = require('pdfmake');

const templates = require('./_master/templates');

// ── Fonts ────────────────────────────────────────────────────────────────────
const FONT_DIR = path.join(__dirname, '_master', 'fonts');
const fonts = {
  DejaVuSans: {
    normal:      path.join(FONT_DIR, 'DejaVuSans.ttf'),
    bold:        path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
    italics:     path.join(FONT_DIR, 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(FONT_DIR, 'DejaVuSans-BoldOblique.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

// ── Auth ─────────────────────────────────────────────────────────────────────
function verifyToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Public: list templates
  if (req.method === 'GET') {
    if (req.query && (req.query.list === '1' || req.query.list === 'true')) {
      return res.status(200).json({ templates: templates.list() });
    }
    return res.status(405).json({ error: 'Use POST to generate, or GET ?list=1' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role === 'Viewer') {
    return res.status(403).json({ error: 'Report generation requires Manager or Admin access' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  const templateId = body && (body.templateId || body.template_id);
  const data = (body && body.data) || {};
  if (!templateId) return res.status(400).json({ error: 'templateId is required' });
  if (!templates.REGISTRY[templateId]) {
    return res.status(400).json({
      error: 'Unknown templateId: ' + templateId,
      available: Object.keys(templates.REGISTRY),
    });
  }

  let docDef;
  try {
    docDef = templates.build(templateId, data);
  } catch (err) {
    return res.status(400).json({ error: 'Template build failed: ' + err.message });
  }

  try {
    const pdfDoc = printer.createPdfKitDocument(docDef);
    const chunks = [];
    pdfDoc.on('data', (ch) => chunks.push(ch));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const filename = (body.filename || safeFilename(templates.REGISTRY[templateId].name)) + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    });
    pdfDoc.on('error', (err) => {
      console.error('pdfmake error', err);
      if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed: ' + err.message });
    });
    pdfDoc.end();
  } catch (err) {
    console.error('Master report error', err);
    return res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
};

function safeFilename(name) {
  return (name || 'report').replace(/[^a-z0-9-_ ]/gi, '_').replace(/\s+/g, '_');
}
