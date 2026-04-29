/**
 * ============================================
 * Sidebar Navigation Component
 * ============================================
 * Responsive sidebar with role-based menu items.
 */

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineChartBar,
  HiOutlineChatAlt2,
  HiOutlineDatabase,
  HiOutlineDocumentReport,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineUserCircle,
} from 'react-icons/hi';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: HiOutlineChartBar, roles: ['admin', 'manager', 'viewer'] },
  { path: '/chatbot', label: 'Chatbot', icon: HiOutlineChatAlt2, roles: ['admin', 'manager', 'viewer'] },
  { path: '/data', label: 'Data Manager', icon: HiOutlineDatabase, roles: ['admin', 'manager'] },
  { path: '/reports', label: 'Reports', icon: HiOutlineDocumentReport, roles: ['admin', 'manager', 'viewer'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter menu items by user role
  const visibleItems = menuItems.filter((item) =>
    item.roles.includes(user?.role)
  );

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <h1 className="text-lg font-bold text-blue-700 tracking-tight">
            Smart Dashboard
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          {collapsed ? <HiOutlineMenu size={20} /> : <HiOutlineX size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-3 px-2">
            <HiOutlineUserCircle size={28} className="text-gray-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <HiOutlineLogout size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
