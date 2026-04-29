/**
 * ============================================
 * KPI Dashboard Page
 * ============================================
 * Shows key metrics with bar, pie, and line charts.
 * Uses Chart.js via react-chartjs-2.
 */

import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import api from '../utils/api';
import { HiOutlineUsers, HiOutlineBriefcase, HiOutlineTrendingUp, HiOutlineClock } from 'react-icons/hi';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [empRes, projRes] = await Promise.all([
          api.get('/data/employees'),
          api.get('/data/projects'),
        ]);
        setEmployees(empRes.data.data);
        setProjects(projRes.data.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ---- Calculate KPIs ----
  const totalEmployees = employees.length;
  const benchCount = employees.filter((e) => e.status === 'Bench').length;
  const assignedCount = totalEmployees - benchCount;
  const avgUtilization = totalEmployees > 0
    ? (employees.reduce((s, e) => s + (e.utilization || 0), 0) / totalEmployees).toFixed(1)
    : 0;
  const activeProjects = projects.filter((p) => p.status === 'Active').length;
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);

  // ---- Chart Data ----

  // Department headcount (Bar)
  const deptCounts = {};
  employees.forEach((e) => {
    deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
  });
  const barData = {
    labels: Object.keys(deptCounts),
    datasets: [{
      label: 'Headcount',
      data: Object.values(deptCounts),
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderRadius: 6,
    }],
  };

  // Project status (Doughnut)
  const statusCounts = { Active: 0, 'On Hold': 0, Completed: 0 };
  projects.forEach((p) => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
  const doughnutData = {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
      borderWidth: 0,
    }],
  };

  // Utilization by employee (Line)
  const sortedEmp = [...employees].sort((a, b) => b.utilization - a.utilization);
  const lineData = {
    labels: sortedEmp.map((e) => e.name.split(' ')[0]),
    datasets: [{
      label: 'Utilization %',
      data: sortedEmp.map((e) => e.utilization),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#3b82f6',
    }],
  };

  // Budget by project (Horizontal Bar)
  const budgetData = {
    labels: projects.map((p) => p.name),
    datasets: [
      {
        label: 'Budget',
        data: projects.map((p) => p.budget / 1000),
        backgroundColor: 'rgba(59,130,246,0.2)',
        borderColor: '#3b82f6',
        borderWidth: 1,
      },
      {
        label: 'Spent',
        data: projects.map((p) => p.spent / 1000),
        backgroundColor: 'rgba(239,68,68,0.2)',
        borderColor: '#ef4444',
        borderWidth: 1,
      },
    ],
  };

  // KPI cards
  const kpis = [
    { label: 'Total Employees', value: totalEmployees, icon: HiOutlineUsers, color: 'blue' },
    { label: 'Bench Count', value: benchCount, icon: HiOutlineClock, color: 'amber' },
    { label: 'Avg Utilization', value: `${avgUtilization}%`, icon: HiOutlineTrendingUp, color: 'green' },
    { label: 'Active Projects', value: activeProjects, icon: HiOutlineBriefcase, color: 'purple' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Key metrics and project overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${colorMap[kpi.color]}`}>
                <kpi.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-xl font-bold text-gray-900">${(totalBudget / 1000000).toFixed(2)}M</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-xl font-bold text-red-600">${(totalSpent / 1000000).toFixed(2)}M</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className="text-xl font-bold text-green-600">${((totalBudget - totalSpent) / 1000000).toFixed(2)}M</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Headcount */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Department Headcount</h3>
          <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>

        {/* Project Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Status</h3>
          <div className="max-w-xs mx-auto">
            <Doughnut data={doughnutData} options={{ responsive: true, cutout: '60%' }} />
          </div>
        </div>

        {/* Utilization */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Employee Utilization</h3>
          <Line data={lineData} options={{ responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }} />
        </div>

        {/* Budget vs Spent */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Budget vs Spent ($K)</h3>
          <Bar
            data={budgetData}
            options={{
              responsive: true,
              indexAxis: 'y',
              plugins: { legend: { position: 'bottom' } },
              scales: { x: { beginAtZero: true } },
            }}
          />
        </div>
      </div>
    </div>
  );
}
