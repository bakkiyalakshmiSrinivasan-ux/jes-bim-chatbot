/**
 * ============================================
 * Data Management Page
 * ============================================
 * View, edit, add, and delete records from JSON data files.
 * Features inline editing and advanced filtering.
 */

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSave,
  HiOutlineX,
  HiOutlineSearch,
  HiOutlineFilter,
} from 'react-icons/hi';

export default function DataManagementPage() {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState('');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Load available files on mount
  useEffect(() => {
    api.get('/data/files').then((res) => {
      setFiles(res.data.files);
      if (res.data.files.length > 0) {
        setActiveFile(res.data.files[0]);
      }
    }).catch(() => toast.error('Failed to load data files.'));
  }, []);

  // Load data when active file changes
  useEffect(() => {
    if (!activeFile) return;
    setLoading(true);
    setEditingId(null);
    setShowAddForm(false);
    setSearchTerm('');
    setFilters({});

    api.get(`/data/${activeFile}`)
      .then((res) => {
        setData(res.data.data);
        setFilteredData(res.data.data);
      })
      .catch(() => toast.error('Failed to load data.'))
      .finally(() => setLoading(false));
  }, [activeFile]);

  // Apply search and filters
  useEffect(() => {
    let result = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some(
          (val) => val && val.toString().toLowerCase().includes(term)
        )
      );
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(
          (item) => item[key] && item[key].toString().toLowerCase() === value.toLowerCase()
        );
      }
    });

    setFilteredData(result);
  }, [data, searchTerm, filters]);

  // Get columns from data
  const columns = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== 'password') : [];

  // Get unique values for filter dropdowns
  const getUniqueValues = (field) => {
    return [...new Set(data.map((item) => item[field]).filter(Boolean))].sort();
  };

  // Filterable fields
  const filterFields = columns.filter((col) =>
    ['status', 'department', 'role', 'category', 'location', 'project', 'manager'].includes(col)
  );

  // ---- CRUD Operations ----

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditRow({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRow({});
  };

  const saveEdit = () => {
    const updated = data.map((item) => (item.id === editingId ? { ...editRow } : item));
    saveData(updated, 'Record updated successfully.');
    setEditingId(null);
  };

  const deleteRecord = (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    const updated = data.filter((item) => item.id !== id);
    saveData(updated, 'Record deleted successfully.');
  };

  const addRecord = () => {
    const maxId = data.reduce((max, item) => Math.max(max, item.id || 0), 0);
    const record = { id: maxId + 1, ...newRow };
    const updated = [...data, record];
    saveData(updated, 'Record added successfully.');
    setShowAddForm(false);
    setNewRow({});
  };

  const saveData = async (updatedData, successMsg) => {
    try {
      await api.post(`/data/${activeFile}`, { data: updatedData });
      setData(updatedData);
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save data.');
    }
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Manager</h1>
          <p className="text-gray-500 text-sm mt-1">View, edit, and manage your data files</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setNewRow({}); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <HiOutlinePlus size={16} /> Add Record
        </button>
      </div>

      {/* File Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-3">
        {files.map((file) => (
          <button
            key={file}
            onClick={() => setActiveFile(file)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeFile === file
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {file}
          </button>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <HiOutlineSearch className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search across all fields..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        {filterFields.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <HiOutlineFilter size={16} /> Filters
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      {showFilters && filterFields.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          {filterFields.map((field) => (
            <div key={field} className="min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{field}</label>
              <select
                value={filters[field] || ''}
                onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All</option>
                {getUniqueValues(field).map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={() => setFilters({})}
            className="self-end px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-gray-500 mb-3">
        Showing {filteredData.length} of {data.length} records
      </p>

      {/* Add New Record Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-800">New Record</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <HiOutlineX size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {columns.filter((c) => c !== 'id').map((col) => (
              <div key={col}>
                <label className="block text-xs text-gray-600 mb-1 capitalize">{col}</label>
                <input
                  type="text"
                  value={newRow[col] || ''}
                  onChange={(e) => setNewRow({ ...newRow, [col]: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            ))}
          </div>
          <button
            onClick={addRecord}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            Save New Record
          </button>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editRow[col] ?? ''}
                          onChange={(e) => setEditRow({ ...editRow, [col]: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50"
                          disabled={col === 'id'}
                        />
                      ) : (
                        <span className="text-gray-700">
                          {Array.isArray(item[col]) ? item[col].join(', ') : (item[col] ?? '—')}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editingId === item.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Save">
                            <HiOutlineSave size={16} />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg" title="Cancel">
                            <HiOutlineX size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                            <HiOutlinePencil size={16} />
                          </button>
                          <button onClick={() => deleteRecord(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                            <HiOutlineTrash size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-400">No records found.</div>
          )}
        </div>
      )}
    </div>
  );
}
