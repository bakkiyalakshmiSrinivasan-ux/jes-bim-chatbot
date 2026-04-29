/**
 * ============================================
 * Data Routes
 * ============================================
 * GET  /api/data/files           - List available data files
 * GET  /api/data/:file           - Read a data file (with optional filters)
 * POST /api/data/:file           - Save/update a data file
 * GET  /api/data/:file/unique/:field - Get unique values for a field
 */

const express = require('express');
const router = express.Router();
const { readData, writeData, listDataFiles } = require('../modules/dataHandler');
const { applyFilters, getUniqueValues } = require('../modules/filter');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All data routes require authentication
router.use(authenticateToken);

/**
 * GET /api/data/files
 * Returns list of available data file names.
 */
router.get('/files', (req, res) => {
  try {
    const files = listDataFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/data/:file
 * Read a data file with optional query-string filters.
 * Example: GET /api/data/employees?status=Bench&department=MEP
 */
router.get('/:file', (req, res) => {
  try {
    const data = readData(req.params.file);
    const filtered = applyFilters(data, req.query);
    res.json({ data: filtered, total: data.length, filtered: filtered.length });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/data/:file/unique/:field
 * Returns unique values for a given field in a data file.
 * Useful for populating filter dropdowns.
 */
router.get('/:file/unique/:field', (req, res) => {
  try {
    const data = readData(req.params.file);
    const values = getUniqueValues(data, req.params.field);
    res.json({ field: req.params.field, values });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * POST /api/data/:file
 * Save updated data to a file.
 * Only admin and manager roles can write data.
 * Body: { data: [...] }
 */
router.post('/:file', authorizeRoles('admin', 'manager'), (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Data must be an array.' });
    }

    // Prevent writing to users file through this route
    if (req.params.file === 'users') {
      return res.status(403).json({ error: 'Cannot modify users through this endpoint.' });
    }

    writeData(req.params.file, data);
    res.json({ message: `${req.params.file}.json updated successfully.`, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
