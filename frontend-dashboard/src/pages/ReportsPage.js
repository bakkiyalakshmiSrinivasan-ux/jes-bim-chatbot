/**
 * ============================================
 * Reports Page
 * ============================================
 * Generate and download PDF reports with filters.
 * Lists previously generated reports.
 */

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  HiOutlineDocumentDownload,
  HiOutlineFilter,
  HiOutlineRefresh,
  HiOutlineTrash,
} from 'react-icons/hi';

const REPORT_TYPES = [
  {
    value: 'bench',
    label: 'Bench Report',
    description: 'Lists all employees currently not assigned to any project.',
    icon: '🪑',
  },
  {
    value: 'resource',
    label: 'Resource Summary',
    description: 'Complete employee listing with utilization and assignment details.',
    icon: '👥',
  },
  {
    value: 'project',
    label: 'Project Overview',
    description: 'All projects with status, budget, and progress information.',
    icon: '📊',
  },
];

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState('bench');
  const [filters, setFilters] = useState({});
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load existing reports
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const res = await api.get('/reports/list');
      setReports(res.data.reports);
    } catch (err) {
      console.error('Failed to load reports');
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/reports/generate', {
        type: selectedType,
        filters,
      });
      toast.success('Report generated!');
      // Open report in new tab
      window.open(`http://localhost:5000${res.data.downloadUrl}`, '_blank');
      loadReports(); // Refresh list
    } catch (err) {
      toast.error('Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Generate and download professional PDF reports</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`p-5 rounded-xl border-2 text-left transition-all ${
              selectedType === type.value
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="text-2xl mb-2">{type.icon}</div>
            <h3 className="font-semibold text-gray-900">{type.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Report Filters (Optional)</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <HiOutlineFilter size={16} />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Assigned">Assigned</option>
                <option value="Bench">Bench</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <select
                value={filters.department || ''}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All</option>
                <option value="MEP">MEP</option>
                <option value="Structural">Structural</option>
                <option value="Architectural">Architectural</option>
                <option value="BIM">BIM</option>
                <option value="Quality">Quality</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All</option>
                <option value="MEP">MEP</option>
                <option value="Structural">Structural</option>
                <option value="Architectural">Architectural</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <select
                value={filters.location || ''}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All</option>
                <option value="Dubai">Dubai</option>
                <option value="Abu Dhabi">Abu Dhabi</option>
                <option value="Riyadh">Riyadh</option>
                <option value="Jeddah">Jeddah</option>
              </select>
            </div>
          </div>
        )}

        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {generating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <HiOutlineDocumentDownload size={18} />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* Generated Reports List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Generated Reports</h3>
          <button onClick={loadReports} className="text-gray-400 hover:text-gray-600">
            <HiOutlineRefresh size={18} />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <HiOutlineDocumentDownload size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No reports generated yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => (
              <div
                key={report.filename}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{report.filename}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(report.createdAt).toLocaleString()} • {report.size}
                  </p>
                </div>
                <a
                  href={`http://localhost:5000${report.downloadUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <HiOutlineDocumentDownload size={16} />
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
