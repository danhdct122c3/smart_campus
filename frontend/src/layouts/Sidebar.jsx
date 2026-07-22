import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Camera, Bell, ShieldAlert, Bot, BarChart2, CheckSquare } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Attendance', icon: Camera, path: '/attendance' },
    { name: 'Analytics', icon: BarChart2, path: '/analytics' },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'AI Assistant', icon: Bot, path: '/ai' },
    { name: 'Security', icon: ShieldAlert, path: '/security' },
    { name: 'Users & Faces', icon: Users, path: '/users' },
    { name: 'Notifications', icon: Bell, path: '/notifications' },
  ];

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
