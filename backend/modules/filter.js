/**
 * ============================================
 * Filter Module
 * ============================================
 * Provides advanced filtering for data arrays.
 * Supports multi-field filtering, search, and date ranges.
 */

/**
 * Apply filters to a data array.
 *
 * @param {Array} data - The array of records
 * @param {Object} filters - Filter criteria object
 *   Example: { status: "Active", department: "MEP", search: "ahmed", dateFrom: "2025-01-01" }
 * @returns {Array} Filtered results
 */
function applyFilters(data, filters = {}) {
  let results = [...data];

  // -- Text search across all string fields --
  if (filters.search) {
    const term = filters.search.toLowerCase();
    results = results.filter((item) =>
      Object.values(item).some(
        (val) =>
          typeof val === 'string' && val.toLowerCase().includes(term)
      )
    );
  }

  // -- Exact match filters (project, role, status, department, category) --
  const exactFields = ['project', 'role', 'status', 'department', 'category', 'location', 'manager'];
  exactFields.forEach((field) => {
    if (filters[field]) {
      const filterVal = filters[field].toLowerCase();
      results = results.filter(
        (item) =>
          item[field] &&
          item[field].toString().toLowerCase() === filterVal
      );
    }
  });

  // -- Date range filters --
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    results = results.filter((item) => {
      const date = new Date(item.startDate || item.joinDate);
      return date >= from;
    });
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    results = results.filter((item) => {
      const date = new Date(item.endDate || item.startDate || item.joinDate);
      return date <= to;
    });
  }

  // -- Numeric range filters (e.g., utilization, progress) --
  if (filters.minUtilization !== undefined) {
    results = results.filter(
      (item) => (item.utilization || 0) >= Number(filters.minUtilization)
    );
  }
  if (filters.maxUtilization !== undefined) {
    results = results.filter(
      (item) => (item.utilization || 0) <= Number(filters.maxUtilization)
    );
  }

  return results;
}

/**
 * Get unique values for a specific field (useful for populating filter dropdowns).
 */
function getUniqueValues(data, field) {
  const values = data
    .map((item) => item[field])
    .filter((val) => val !== null && val !== undefined);
  return [...new Set(values)].sort();
}

module.exports = { applyFilters, getUniqueValues };
