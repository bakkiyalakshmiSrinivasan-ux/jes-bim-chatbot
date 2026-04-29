/**
 * ============================================
 * Data Handler Module
 * ============================================
 * Handles reading and writing JSON data files.
 * All data is stored in the /data folder as JSON.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Read a JSON data file.
 * @param {string} filename - Name of the file (e.g., "projects")
 * @returns {Array} Parsed JSON array
 */
function readData(filename) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file "${filename}.json" not found.`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Write data back to a JSON file.
 * @param {string} filename - Name of the file (e.g., "projects")
 * @param {Array} data - Array of records to save
 */
function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * List all available data files (without .json extension).
 * Excludes the users file for security.
 */
function listDataFiles() {
  const files = fs.readdirSync(DATA_DIR);
  return files
    .filter((f) => f.endsWith('.json') && f !== 'users.json')
    .map((f) => f.replace('.json', ''));
}

module.exports = { readData, writeData, listDataFiles };
