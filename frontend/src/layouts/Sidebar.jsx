import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Camera, Bell, ShieldAlert, Bot, BarChart2, CheckSquare, ClipboardList, UserCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role || 'STAFF';

  // Định nghĩa các menu có gán roles được phép truy cập
  const allNavItems = [
    { name: 'Dashboard', icon: BarChart2, path: '/', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM', 'STAFF', 'SECURITY', 'MAINTENANCE'] },
    { name: 'Tasks (Công việc)', icon: CheckSquare, path: '/tasks', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM', 'STAFF', 'SECURITY', 'MAINTENANCE'] },
    { name: 'AI Assistant', icon: Bot, path: '/ai', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM'] },
    { name: 'Users & Faces', icon: Users, path: '/users', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PM', 'PO'] },
    { name: 'Security', icon: ShieldAlert, path: '/security', roles: ['ADMIN', 'DIRECTOR'] },
    // Menu chung ai cũng thấy
    { name: 'My Profile', icon: UserCircle, path: '/profile', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM', 'STAFF', 'SECURITY', 'MAINTENANCE'] },
    { name: 'Attendance', icon: Camera, path: '/attendance', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM', 'STAFF', 'SECURITY', 'MAINTENANCE'] },
    { name: 'Notifications', icon: Bell, path: '/notifications', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM', 'STAFF', 'SECURITY', 'MAINTENANCE'] },
  ];

  // Lọc menu theo role của user hiện tại
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <div style={{ 
          width: '40px', height: '40px', 
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Camera size={24} color="white" />
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Smart<span style={{ color: 'var(--accent-primary)' }}>Campus</span>
        </h1>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'white' : 'var(--text-muted)',
                background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 600 : 500
              })}
            >
              <Icon size={20} style={{ opacity: 0.8 }} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
